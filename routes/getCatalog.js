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
  const uid = decoded.sub;

  try {
    // Get user's class period
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userData = userDoc.data();
    const userPeriod = userData.class_period;

    // Fetch catalog from single document
    const catalogDoc = await db.collection('store_catalog').doc('items').get();
    
    if (!catalogDoc.exists) {
      return res.status(200).json({ items: [], version: Date.now() });
    }

    const catalogData = catalogDoc.data();
    const allItems = catalogData.items || [];
    
    // Filter for enabled items and user's period
    const items = allItems
      .filter(item => {
        if (!item.enabled) return false;
        const validPeriods = item.validPeriods || [];
        return validPeriods.length === 0 || validPeriods.includes(userPeriod);
      })
      .map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        stock: item.stock,
        maxPerUser: item.maxPerUser,
        validPeriods: item.validPeriods,
        createdAt: item.createdAt || Date.now()
      }));

    return res.status(200).json({ 
      items,
      version: catalogData.version || Date.now()
    });

  } catch (error) {
    console.error('getCatalog error:', error);
    return res.status(500).json({ message: 'Failed to fetch catalog' });
  }
};
