const { admin, db } = require('../firebase');
const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const sanitizeHtml = require('sanitize-html');

const textOnly = value => sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} }).trim();
const richText = value => sanitizeHtml(String(value ?? ''), {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre', 'img'],
  allowedAttributes: { a: ['href'], img: ['src', 'alt'] },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: { img: ['https'] }
});

function cleanFields(input, partial = false) {
  const allowed = ['title', 'description', 'body', 'pinned', 'patchnote'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key))) {
    throw new Error('Invalid announcement fields');
  }
  const out = {};
  for (const field of ['title', 'description', 'body']) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string' || input[field].length > (field === 'body' ? 20000 : field === 'description' ? 500 : 200)) {
      throw new Error(`Invalid ${field}`);
    }
    out[field] = field === 'body' ? richText(input[field]) : textOnly(input[field]);
  }
  for (const field of ['pinned', 'patchnote']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'boolean') throw new Error(`Invalid ${field}`);
      out[field] = input[field];
    }
  }
  if (!partial && (!out.title || !out.body)) throw new Error('Title and body are required');
  if (partial && Object.keys(out).length === 0) throw new Error('No announcement fields supplied');
  return out;
}

function safeAnnouncement(data) {
  return {
    ...data,
    title: textOnly(data.title || ''),
    description: textOnly(data.description || ''),
    body: richText(data.body || ''),
    createdBy: textOnly(data.createdBy || ''),
    editedBy: textOnly(data.editedBy || '')
  };
}

async function notifyAllUsers(announcement) {
  try {
    if (announcement.patchnote) {
      console.log('Announcement is patch note, skipping notifications for', announcement.id);
      return true;
    }
    console.log('Starting notification process for announcement:', announcement.id);
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('No users found to notify');
      return true;
    }
      const notification = {
      type: 'announcement',
      message: `New announcement: ${announcement.title}`,
      read: false,
      timestamp: new Date(),
      announcementId: announcement.id
    };
    
    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const currentNotifications = userData.notifications || [];
      
      const updatedNotifications = [notification, ...currentNotifications];
      
      const userRef = db.collection('users').doc(userDoc.id);
      batch.update(userRef, { notifications: updatedNotifications });
      
      operationCount++;
      
      if (operationCount >= batchSize) {
        console.log(`Committing batch of ${operationCount} notification updates`);
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }
    
    if (operationCount > 0) {
      console.log(`Committing final batch of ${operationCount} notification updates`);
      await batch.commit();
    }
    
    console.log(`Notification sent to ${usersSnapshot.size} users about announcement: ${announcement.title}`);
    return true;
  } catch (error) {
    console.error('Error sending notifications to users:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('announcements').orderBy('date', 'desc').get();
      const items = snapshot.docs.map(doc => safeAnnouncement({ id: doc.id, ...doc.data() }));
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load announcements', error: error.toString() });
    }
  }

  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  let decoded;
  try {
    decoded = await verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Token verification failed' });
    }
    const roles = decoded['https://mo-classroom.us/roles'] || [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed', error: err.toString() });
  }

  const getAdminName = async () => {
    let name = null;
    
    if (decoded.nickname) {
      name = decoded.nickname;
    } else if (decoded.name) {
      name = decoded.name;
    }
    
    if (!name && decoded.sub) {
      const userId = decoded.sub;
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists && userDoc.data().name) {
          name = userDoc.data().name;
        }
      } catch (e) {
        console.error('Error fetching user data:', e);
      }
    }
    
    if (!name && decoded.email) {
      name = decoded.email.split('@')[0];
    }
    
    return textOnly(name || 'Admin').slice(0, 100);
  };

  const id = req.query.id;  
    if (req.method === 'POST') {
    let fields;
    try { fields = cleanFields(req.body); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const { title, description, body, pinned, patchnote } = fields;

    const teacherId = process.env.TEACHER_ID;
    if (!patchnote && decoded.sub !== teacherId) {
      return res.status(403).json({ message: 'Only the teacher may post announcements' });
    }

    try {
      const creatorName = await getAdminName();

      const data = {
        title,
        description: description || '',
        body,
        date: admin.firestore.FieldValue.serverTimestamp(),
        pinned: Boolean(pinned),
        patchnote: Boolean(patchnote),
        createdBy: creatorName,
        isEdited: false
      };

      const ref = await db.collection('announcements').add(data);
      console.log('Created new announcement with ID:', ref.id);

      const announcement = {
        id: ref.id,
        ...data,
        date: new Date()
      };

      try {
        await notifyAllUsers(announcement);
        console.log('Successfully sent notifications for announcement:', ref.id);
      } catch (notifyError) {
        console.error('Failed to send notifications:', notifyError);
      }

      const doc = await ref.get();
      const finalData = safeAnnouncement({ id: ref.id, ...doc.data() });

      return res.status(201).json(finalData);
    } catch (error) {
      console.error('Error creating announcement:', error);
      return res.status(500).json({ message: 'Failed to create announcement', error: error.toString() });
    }
  }
  
  if (req.method === 'PUT') {
    if (typeof id !== 'string' || !id || id.length > 128) return res.status(400).json({ message: 'Invalid announcement id' });
    try {
      const updates = cleanFields(req.body, true);
      
      if (updates.body || updates.title || updates.description) {
        updates.lastModified = admin.firestore.FieldValue.serverTimestamp();
        updates.isEdited = true;
        
        updates.editedBy = await getAdminName();
      }
      
      await db.collection('announcements').doc(id).update(updates);
      const updated = await db.collection('announcements').doc(id).get();
      return res.status(200).json(safeAnnouncement({ id, ...updated.data() }));
    } catch (error) {
      if (error.message.startsWith('Invalid ') || error.message === 'No announcement fields supplied') {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Failed to update announcement', error: error.toString() });
    }
  }
  
  if (req.method === 'DELETE') {
    if (typeof id !== 'string' || !id || id.length > 128) return res.status(400).json({ message: 'Invalid announcement id' });
    try {
      await db.collection('announcements').doc(id).delete();
      return res.status(200).json({ message: 'Deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete announcement', error: error.toString() });
    }
  }
  
  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
};
