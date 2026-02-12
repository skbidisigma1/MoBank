const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }

  // Check admin role
  const roles = decoded['https://mo-classroom.us/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    // Fetch catalog from single document
    const catalogDoc = await db.collection('store_catalog').doc('items').get();
    
    if (!catalogDoc.exists) {
      return res.status(200).json({ items: [], version: Date.now() });
    }

    const catalogData = catalogDoc.data();
    const items = (catalogData.items || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      maxPerUser: item.maxPerUser,
      validPeriods: item.validPeriods || [],
      enabled: item.enabled !== false,
      hasImage: item.hasImage,
      imageVersion: item.imageVersion,
      createdAt: item.createdAt || Date.now()
    }));

    // Sort by creation date descending
    items.sort((a, b) => b.createdAt - a.createdAt);

    return res.status(200).json({ 
      items,
      version: catalogData.version || Date.now()
    });

  } catch (error) {
    console.error('getCatalogAdmin error:', error);
    return res.status(500).json({ message: 'Failed to fetch catalog' });
  }
};
