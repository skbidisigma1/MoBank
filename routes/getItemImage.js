const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Validate Auth
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }
  
  const itemId = req.query.id;
  if (!itemId) {
    return res.status(400).json({ message: 'Item ID required' });
  }
  
  try {
    const doc = await db.collection('store_images').doc(itemId).get();
    if (!doc.exists) {
        return res.status(404).json({ message: 'Image not found' });
    }
    
    // Cache control
    res.setHeader('Cache-Control', 'private, max-age=180');
    
    const data = doc.data();
    return res.status(200).json({ 
        id: itemId,
        base64: data.base64,
        updatedAt: data.updatedAt 
    });
    
  } catch (error) {
    console.error('getItemImage error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
