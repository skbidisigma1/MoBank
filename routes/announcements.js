const { admin, db } = require('../firebase');

const { verifyToken, getTokenFromHeader } = require('../auth-helper');

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
      const doc = await ref.get();
      return res.status(201).json({ id: ref.id, ...doc.data() });
    } catch (error) {
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
      
      // Only mark as edited if content is changed (not just pinned status)
      if (updates.body || updates.title || updates.description) {
        updates.lastModified = admin.firestore.FieldValue.serverTimestamp();
        updates.isEdited = true;
        
        // Get editor's name
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
