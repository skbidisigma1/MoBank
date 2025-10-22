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
    // Fetch user's orders from their document
    const userOrdersDoc = await db.collection('store_orders').doc(uid).get();

    if (!userOrdersDoc.exists) {
      return res.status(200).json({ orders: [] });
    }

    const userOrdersData = userOrdersDoc.data();
    const orders = (userOrdersData.orders || []).map(order => ({
      id: order.id,
      items: order.items,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      fulfilledBy: order.fulfilledBy,
      fulfilledAt: order.fulfilledAt || null,
      cancelledBy: order.cancelledBy || null,
      cancelReason: order.cancelReason || null
    }));

    return res.status(200).json({ orders });

  } catch (error) {
    console.error('getOrders error:', error);
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
};
