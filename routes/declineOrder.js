const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const parseRequestBody = require('../request-body');

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
  const adminName = decoded.name || decoded['https://mo-classroom.us/name'] || 'Admin';

  let bodyData;
  try {
    bodyData = await parseRequestBody(req);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const { orderId, userId, reason: rawReason } = bodyData;

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ message: 'Order ID required' });
  }

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'User ID required' });
  }
  if (rawReason !== undefined && rawReason !== null && typeof rawReason !== 'string') {
    return res.status(400).json({ message: 'Invalid decline reason' });
  }
  const reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, 500) : '';

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
      const orders = Array.isArray(userOrdersData.orders) ? [...userOrdersData.orders] : [];
      const orderIndex = orders.findIndex(o => o.id === orderId);

      if (orderIndex === -1) {
        throw new Error('Order not found');
      }

      const order = orders[orderIndex];

      if (order.status !== 'pending') {
        throw new Error(order.status === 'cancelled'
          ? 'Order already cancelled'
          : 'Cannot decline an order unless it is pending');
      }

      // Read user data
      const userDoc = await tx.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const refundAmount = order.total;
      if (!Number.isSafeInteger(refundAmount) || refundAmount < 0) {
        throw new Error('Invalid order refund amount');
      }

      // Read catalog
      const catalogDoc = await tx.get(catalogRef);
      if (!catalogDoc.exists) {
        throw new Error('Catalog not found');
      }

      const catalogData = catalogDoc.data();
      const catalogItems = Array.isArray(catalogData.items) ? catalogData.items : [];
      
      // Now do ALL writes
      // Update order status
      orders[orderIndex] = {
        ...order,
        status: 'cancelled',
        cancelledBy: adminUid,
        cancelledByName: adminName,
        cancelledAt: Date.now(),
        cancelReason: reason || 'Declined by admin'
      };

      tx.set(userOrdersRef, {
        orders,
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });

      // Refund the user
      const currentBalance = Number(userData.currency_balance ?? 0);
      const newBalance = currentBalance + refundAmount;
      if (!Number.isFinite(currentBalance) || !Number.isFinite(newBalance) ||
          Math.abs(currentBalance) > Number.MAX_SAFE_INTEGER ||
          Math.abs(newBalance) > Number.MAX_SAFE_INTEGER) {
        throw new Error('Invalid user balance');
      }

      // Restore finite stock, summing duplicate item rows in older orders too.
      const restoredQuantities = new Map();
      for (const orderItem of Array.isArray(order.items) ? order.items : []) {
        if (!orderItem || typeof orderItem.id !== 'string' ||
            !Number.isSafeInteger(orderItem.quantity) || orderItem.quantity < 1) continue;
        restoredQuantities.set(
          orderItem.id,
          (restoredQuantities.get(orderItem.id) || 0) + orderItem.quantity
        );
      }

      const updatedCatalogItems = catalogItems.map(catalogItem => {
        const restoredQuantity = catalogItem && restoredQuantities.get(catalogItem.id);
        if (restoredQuantity && catalogItem.stock != null) {
          if (!Number.isSafeInteger(catalogItem.stock) || catalogItem.stock < 0 ||
              !Number.isSafeInteger(catalogItem.stock + restoredQuantity)) {
            throw new Error('Invalid catalog stock');
          }
          return {
            ...catalogItem,
            stock: catalogItem.stock + restoredQuantity
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

      const transactions = Array.isArray(userData.transactions) ? [...userData.transactions] : [];
      transactions.unshift(transaction);
      const trimmedTransactions = transactions.slice(0, 100);

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

      const notifications = Array.isArray(userData.notifications) ? [...userData.notifications] : [];
      notifications.unshift(notification);
      const trimmedNotifications = notifications.slice(0, 10).sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });
      
      tx.update(userRef, {
        currency_balance: newBalance,
        transactions: trimmedTransactions,
        notifications: trimmedNotifications
      });
    });

    return res.status(200).json({ message: 'Order declined and refunded successfully' });

  } catch (error) {
    console.error('declineOrder error:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('already') || 
        error.message.includes('Cannot decline') ||
        error.message.includes('Invalid')) {
      return res.status(400).json({ message: error.message });
    }
    
    return res.status(500).json({ message: 'Failed to decline order' });
  }
};
