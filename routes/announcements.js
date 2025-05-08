const { admin, db } = require('../firebase');

const { verifyToken, getTokenFromHeader } = require('../auth-helper');

async function notifyAllUsers(announcement) {
  try {
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
      
      // Create a new array with the notification at the beginning
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
    throw error; // Re-throw to make sure the error is properly handled
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('announcements').orderBy('date', 'desc').get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    
    return name || 'Admin';
  };

  const id = req.query.id;  
    if (req.method === 'POST') {
    const { title, description, body, pinned } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: 'Missing required fields' });
    }    
    
    try {
      const creatorName = await getAdminName();
      
      const data = { 
        title, 
        description: description || '', 
        body, 
        date: admin.firestore.FieldValue.serverTimestamp(),
        pinned: Boolean(pinned),
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
      const finalData = { id: ref.id, ...doc.data() };
      
      return res.status(201).json(finalData);
    } catch (error) {
      console.error('Error creating announcement:', error);
      return res.status(500).json({ message: 'Failed to create announcement', error: error.toString() });
    }
  }
  
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ message: 'Missing announcement id' });
    try {
      const updates = { ...req.body };
      
      if ('pinned' in updates) {
        updates.pinned = Boolean(updates.pinned);
      }
      
      if (updates.body || updates.title || updates.description) {
        updates.lastModified = admin.firestore.FieldValue.serverTimestamp();
        updates.isEdited = true;
        
        updates.editedBy = await getAdminName();
      }
      
      await db.collection('announcements').doc(id).update(updates);
      const updated = await db.collection('announcements').doc(id).get();
      return res.status(200).json({ id, ...updated.data() });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update announcement', error: error.toString() });
    }
  }
  
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ message: 'Missing announcement id' });
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
  