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
    // Fetch all store_orders documents (one per user)
    const ordersSnapshot = await db.collection('store_orders').get();

    const allOrders = [];
    const userIds = [];

    // Collect all orders from all users
    ordersSnapshot.forEach(doc => {
      const userId = doc.id;
      userIds.push(userId);
      const data = doc.data();
      const userOrders = data.orders || [];
      
      userOrders.forEach(order => {
        allOrders.push({
          ...order,
          userId
        });
      });
    });

    // Fetch user data for all users
    const userDataMap = {};
    const userPromises = userIds.map(async (uid) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userDataMap[uid] = {
            name: userData.name || 'Unknown',
            period: userData.class_period
          };
        }
      } catch (err) {
        console.error(`Failed to fetch user ${uid}:`, err);
      }
    });

    await Promise.all(userPromises);

    // Build orders array with user info and sort
    const orders = allOrders
      .map(order => {
        const userInfo = userDataMap[order.userId] || { name: 'Unknown', period: null };
        return {
          id: order.id,
          userId: order.userId,
          userName: userInfo.name,
          userPeriod: userInfo.period,
          items: order.items,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
          fulfilledBy: order.fulfilledBy,
          fulfilledAt: order.fulfilledAt || null
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first

    return res.status(200).json({ orders });

  } catch (error) {
    console.error('getOrdersAdmin error:', error);
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
};
