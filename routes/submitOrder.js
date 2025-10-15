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
  const uid = decoded.sub;

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
	
  const { items } = bodyData;

  // Validate items array
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Invalid order: items array required' });
  }

  if (items.length > 20) {
    return res.status(400).json({ message: 'Order exceeds maximum of 20 items' });
  }

  const admin = require('firebase-admin');
  const userRef = db.collection('users').doc(uid);
  const catalogRef = db.collection('store_catalog');

  try {
    // Use transaction for atomic balance deduction and order creation
    const result = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentBalance = userData.currency_balance || 0;

      // Validate and calculate order
      const orderItems = [];
      let totalCost = 0;

      for (const item of items) {
        if (!item.id || !item.quantity || item.quantity < 1) {
          throw new Error('Invalid item format');
        }

        const catalogDoc = await tx.get(catalogRef.doc(item.id));
        if (!catalogDoc.exists) {
          throw new Error(`Item not found: ${item.id}`);
        }

        const catalogItem = catalogDoc.data();
        
        // Check if item is enabled
        if (catalogItem.enabled === false) {
          throw new Error(`Item unavailable: ${catalogItem.name}`);
        }

        // Check stock
        if (catalogItem.stock !== null && catalogItem.stock < item.quantity) {
          throw new Error(`Insufficient stock for: ${catalogItem.name}`);
        }

        // Check per-user limit
        if (catalogItem.maxPerUser !== null && item.quantity > catalogItem.maxPerUser) {
          throw new Error(`Per-user limit exceeded for: ${catalogItem.name}`);
        }

        const itemTotal = catalogItem.price * item.quantity;
        totalCost += itemTotal;

        orderItems.push({
          id: item.id,
          name: catalogItem.name,
          price: catalogItem.price,
          quantity: item.quantity,
          total: itemTotal
        });

        // Decrement stock if limited
        if (catalogItem.stock !== null) {
          tx.update(catalogRef.doc(item.id), {
            stock: admin.firestore.FieldValue.increment(-item.quantity)
          });
        }
      }

      // Check balance
      if (currentBalance < totalCost) {
        throw new Error('Insufficient balance');
      }

      // Create order
      const orderRef = db.collection('store_orders').doc();
      const orderId = orderRef.id;
      
      const orderData = {
        userId: uid,
        items: orderItems,
        total: totalCost,
        status: 'pending',
        createdAt: admin.firestore.Timestamp.now(),
        fulfilledBy: null,
        fulfilledAt: null
      };

      tx.set(orderRef, orderData);

      // Deduct balance
      const newBalance = currentBalance - totalCost;
      tx.update(userRef, { currency_balance: newBalance });

      // Add transaction record
      const transaction = {
        type: 'debit',
        amount: totalCost,
        counterpart: 'MoStore',
        timestamp: admin.firestore.Timestamp.now(),
        orderId: orderId
      };

      const transactions = userData.transactions || [];
      transactions.unshift(transaction);
      const trimmedTransactions = transactions.slice(0, 8);
      tx.update(userRef, { transactions: trimmedTransactions });

      // Add notification
      const notification = {
        type: 'store_order',
        message: `Order placed: ${orderItems.length} ${orderItems.length === 1 ? 'item' : 'items'} for $${totalCost.toLocaleString()}. Pending fulfillment.`,
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

      return { orderId, totalCost, newBalance, itemCount: orderItems.length };
    });

    return res.status(200).json({
      message: 'Order placed successfully',
      orderId: result.orderId,
      total: result.totalCost,
      newBalance: result.newBalance,
      itemCount: result.itemCount
    });

  } catch (error) {
    console.error('submitOrder error:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('unavailable') || 
        error.message.includes('Insufficient') ||
        error.message.includes('limit') ||
        error.message.includes('Invalid')) {
      return res.status(400).json({ message: error.message });
    }
    
    return res.status(500).json({ message: 'Failed to place order' });
  }
};

