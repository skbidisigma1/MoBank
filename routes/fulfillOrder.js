const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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

  const adminUid = decoded.sub;

  let bodyData = {};
  if (req.body && Object.keys(req.body).length) {
    bodyData = req.body;
  } else {
    let raw = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => (raw += chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    try {
      bodyData = JSON.parse(raw || '{}');
    } catch {
      return res.status(400).json({ message: 'Invalid JSON format' });
    }
  }

  const { orderId } = bodyData;

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ message: 'Order ID required' });
  }

  const admin = require('firebase-admin');
  const orderRef = db.collection('store_orders').doc(orderId);

  try {
    await db.runTransaction(async (tx) => {
      const orderDoc = await tx.get(orderRef);
      if (!orderDoc.exists) {
        throw new Error('Order not found');
      }

      const orderData = orderDoc.data();
      
      if (orderData.status === 'fulfilled') {
        throw new Error('Order already fulfilled');
      }

      if (orderData.status === 'cancelled') {
        throw new Error('Cannot fulfill cancelled order');
      }

      // Update order status
      tx.update(orderRef, {
        status: 'fulfilled',
        fulfilledBy: adminUid,
        fulfilledAt: admin.firestore.Timestamp.now()
      });

      // Send notification to user
      const userRef = db.collection('users').doc(orderData.userId);
      const userDoc = await tx.get(userRef);
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const notification = {
          type: 'store_fulfilled',
          message: `Your order (${orderData.items.length} ${orderData.items.length === 1 ? 'item' : 'items'}) has been fulfilled! Check with your teacher to claim your rewards.`,
          timestamp: admin.firestore.Timestamp.now(),
          read: false,
          orderId: orderId
        };

        const notifications = userData.notifications || [];
        notifications.unshift(notification);
        const trimmedNotifications = notifications.slice(0, 10).sort((a, b) => {
          const aTime = a.timestamp?.toMillis?.() || 0;
          const bTime = b.timestamp?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        tx.update(userRef, { notifications: trimmedNotifications });
      }
    });

    return res.status(200).json({ message: 'Order fulfilled successfully' });

  } catch (error) {
    console.error('fulfillOrder error:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('already fulfilled') || 
        error.message.includes('cancelled')) {
      return res.status(400).json({ message: error.message });
    }
    
    return res.status(500).json({ message: 'Failed to fulfill order' });
  }
};
