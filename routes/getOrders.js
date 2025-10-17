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
    // Fetch user's orders
    const ordersSnapshot = await db.collection('store_orders')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const orders = [];
    ordersSnapshot.forEach(doc => {
      const data = doc.data();
      orders.push({
        id: doc.id,
        items: data.items,
        total: data.total,
        status: data.status,
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
        fulfilledBy: data.fulfilledBy,
        fulfilledAt: data.fulfilledAt?.toMillis?.() || null
      });
    });

    return res.status(200).json({ orders });

  } catch (error) {
    console.error('getOrders error:', error);
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
};
