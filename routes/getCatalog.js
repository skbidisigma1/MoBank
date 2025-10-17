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

    // Fetch all enabled catalog items
    const catalogSnapshot = await db.collection('store_catalog')
      .where('enabled', '==', true)
      .get();

    const items = [];
    catalogSnapshot.forEach(doc => {
      const data = doc.data();
      const validPeriods = data.validPeriods || [];
      
      // Include item if validPeriods is empty (all periods) or includes user's period
      if (validPeriods.length === 0 || validPeriods.includes(userPeriod)) {
        items.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          price: data.price,
          stock: data.stock,
          category: data.category,
          maxPerUser: data.maxPerUser,
          validPeriods: data.validPeriods,
          createdAt: data.createdAt?.toMillis?.() || Date.now()
        });
      }
    });

    return res.status(200).json({ 
      items,
      version: Date.now() // For client cache invalidation
    });

  } catch (error) {
    console.error('getCatalog error:', error);
    return res.status(500).json({ message: 'Failed to fetch catalog' });
  }
};
