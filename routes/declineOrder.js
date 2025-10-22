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

  const { orderId, userId, reason } = bodyData;

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ message: 'Order ID required' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'User ID required' });
  }

  const admin = require('firebase-admin');
  const userOrdersRef = db.collection('store_orders').doc(userId);
  const userRef = db.collection('users').doc(userId);
  const catalogRef = db.collection('store_catalog').doc('items');

  try {
    await db.runTransaction(async (tx) => {
      // Do ALL reads first
      const userOrdersDoc = await tx.get(userOrdersRef);
      if (!userOrdersDoc.exists) {
        throw new Error('User orders not found');
      }

      const userOrdersData = userOrdersDoc.data();
      const orders = userOrdersData.orders || [];
      const orderIndex = orders.findIndex(o => o.id === orderId);

      if (orderIndex === -1) {
        throw new Error('Order not found');
      }

      const order = orders[orderIndex];

      if (order.status === 'fulfilled') {
        throw new Error('Cannot decline fulfilled order');
      }

      if (order.status === 'cancelled') {
        throw new Error('Order already cancelled');
      }

      // Read user data
      const userDoc = await tx.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const refundAmount = order.total;

      // Read catalog
      const catalogDoc = await tx.get(catalogRef);
      if (!catalogDoc.exists) {
        throw new Error('Catalog not found');
      }

      const catalogData = catalogDoc.data();
      const catalogItems = catalogData.items || [];
      
      // Now do ALL writes
      // Update order status
      orders[orderIndex] = {
        ...order,
        status: 'cancelled',
        cancelledBy: adminUid,
        cancelledAt: Date.now(),
        cancelReason: reason || 'Declined by admin'
      };

      tx.set(userOrdersRef, {
        orders,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });

      // Refund the user
      const newBalance = (userData.currency_balance || 0) + refundAmount;
      tx.update(userRef, { currency_balance: newBalance });

      // Restore stock for items (CRITICAL BUG FIX: check for null stock)
      const updatedCatalogItems = catalogItems.map(catalogItem => {
        const orderItem = order.items.find(item => item.id === catalogItem.id);
        if (orderItem && catalogItem.stock !== null) {
          // Only restore stock if it's not unlimited (null)
          return {
            ...catalogItem,
            stock: catalogItem.stock + orderItem.quantity
          };
        }
        return catalogItem;
      });

      tx.set(catalogRef, {
        items: updatedCatalogItems,
        version: Date.now(),
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });

      // Add refund transaction
      const transaction = {
        type: 'credit',
        amount: refundAmount,
        counterpart: 'MoStore Refund',
        timestamp: admin.firestore.Timestamp.now(),
        orderId: orderId
      };

      const transactions = userData.transactions || [];
      transactions.unshift(transaction);
      const trimmedTransactions = transactions.slice(0, 8);
      tx.update(userRef, { transactions: trimmedTransactions });

      // Send notification to user
      const notificationMessage = reason 
        ? `Your order was declined: ${reason}. You have been refunded $${refundAmount.toLocaleString()}.`
        : `Your order was declined. You have been refunded $${refundAmount.toLocaleString()}.`;
      
      const notification = {
        type: 'store_declined',
        message: notificationMessage,
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
    });

    return res.status(200).json({ message: 'Order declined and refunded successfully' });

  } catch (error) {
    console.error('declineOrder error:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('already') || 
        error.message.includes('Cannot decline')) {
      return res.status(400).json({ message: error.message });
    }
    
    return res.status(500).json({ message: 'Failed to decline order' });
  }
};
