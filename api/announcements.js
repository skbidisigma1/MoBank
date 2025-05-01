const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { admin, db } = require('../firebase');

// JWKS client for Auth0 token verification
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Verify JWT and ensure 'admin' role
function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    });
    const roles = decoded['https://mo-classroom.us/roles'] || [];
    if (!roles.includes('admin')) {
      res.status(403).json({ message: 'Forbidden: Admins only' });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ message: 'Token verification failed', error: err.toString() });
    return null;
  }
}

module.exports = async (req, res) => {
  // Public: list all announcements
  if (req.method === 'GET') {
    try {
      const snapshot = await db.collection('announcements').orderBy('date', 'desc').get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(items);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to load announcements', error: error.toString() });
    }
  }
  // Other methods require admin access
  const adminUser = verifyAdmin(req, res);
  if (!adminUser) return;

  const id = req.query.id;
  // Create new announcement
  if (req.method === 'POST') {
    const { title, description, body, date } = req.body;
    if (!title || !body || !date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      const ref = await db.collection('announcements').add({ title, description: description || '', body, date });
      const doc = await ref.get();
      return res.status(201).json({ id: ref.id, ...doc.data() });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to create announcement', error: error.toString() });
    }
  }
  // Update an announcement
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ message: 'Missing announcement id' });
    try {
      await db.collection('announcements').doc(id).update(req.body);
      const updated = await db.collection('announcements').doc(id).get();
      return res.status(200).json({ id, ...updated.data() });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update announcement', error: error.toString() });
    }
  }
  // Delete an announcement
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ message: 'Missing announcement id' });
    try {
      await db.collection('announcements').doc(id).delete();
      return res.status(200).json({ message: 'Deleted' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete announcement', error: error.toString() });
    }
  }
  // Method not allowed
  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
};
