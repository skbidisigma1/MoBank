const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const generateOrderId = () => {
  return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

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
  const catalogRef = db.collection('store_catalog').doc('items');
  const userOrdersRef = db.collection('store_orders').doc(uid);

  try {
    // Pre-fetch catalog OUTSIDE transaction to reduce lock contention
    const catalogDoc = await catalogRef.get();
    if (!catalogDoc.exists) {
      return res.status(400).json({ message: 'Catalog not found' });
    }

    const catalogData = catalogDoc.data();
    const catalogItems = catalogData.items || [];
    const catalogMap = new Map(catalogItems.map(item => [item.id, item]));

    // Pre-validate items exist and are enabled
    for (const item of items) {
      const catalogItem = catalogMap.get(item.id);
      if (!catalogItem) {
        return res.status(400).json({ message: `Item not found: ${item.id}` });
      }
      if (catalogItem.enabled === false) {
        return res.status(400).json({ message: `Item unavailable: ${catalogItem.name}` });
      }
    }

    // Now run transaction with only user and orders documents
    const result = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentBalance = userData.currency_balance || 0;
      const userPeriod = userData.class_period;

      // Get user's existing orders to check per-user limits
      const userOrdersDoc = await tx.get(userOrdersRef);
      const userOrdersData = userOrdersDoc.exists ? userOrdersDoc.data() : { orders: [] };
      const existingOrders = userOrdersData.orders || [];

      // Check if order limit reached
      if (existingOrders.length >= 1200) {
        throw new Error('Order limit reached. Please contact an administrator.');
      }

      // Re-read catalog inside transaction only if we need to update stock
      let needsStockUpdate = false;
      for (const item of items) {
        const catalogItem = catalogMap.get(item.id);
        if (catalogItem && catalogItem.stock !== null) {
          needsStockUpdate = true;
          break;
        }
      }

      // Only lock catalog if updating stock
      let freshCatalogItems = catalogItems;
      if (needsStockUpdate) {
        const freshCatalogDoc = await tx.get(catalogRef);
        if (!freshCatalogDoc.exists) {
          throw new Error('Catalog not found');
        }
        freshCatalogItems = freshCatalogDoc.data().items || [];
      }

      const freshCatalogMap = new Map(freshCatalogItems.map(item => [item.id, item]));

      // Validate and calculate order
      const orderItems = [];
      let totalCost = 0;
      const stockUpdates = new Map(); // Track stock changes

      for (const item of items) {
        if (!item.id || !item.quantity || item.quantity < 1 || !Number.isInteger(item.quantity)) {
          throw new Error('Invalid item format');
        }

        const catalogItem = freshCatalogMap.get(item.id);
        if (!catalogItem) {
          throw new Error(`Item not found: ${item.id}`);
        }

        // Check if item is enabled
        if (catalogItem.enabled === false) {
          throw new Error(`Item unavailable: ${catalogItem.name}`);
        }

        // Check class period eligibility
        const validPeriods = catalogItem.validPeriods || [];
        if (validPeriods.length > 0 && !validPeriods.includes(userPeriod)) {
          throw new Error(`Item not available for your class period: ${catalogItem.name}`);
        }

        // Check stock
        if (catalogItem.stock !== null) {
          const currentStock = stockUpdates.has(item.id) 
            ? stockUpdates.get(item.id) 
            : catalogItem.stock;
          
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for: ${catalogItem.name}`);
          }
          
          stockUpdates.set(item.id, currentStock - item.quantity);
        }

        // Check per-user limit (INSIDE TRANSACTION for atomicity)
        if (catalogItem.maxPerUser !== null) {
          // Count how many of this item user has already ordered (fulfilled + pending)
          let totalPurchased = 0;
          
          for (const order of existingOrders) {
            if (order.status === 'fulfilled' || order.status === 'pending') {
              const orderItem = order.items.find(i => i.id === item.id);
              if (orderItem) {
                totalPurchased += orderItem.quantity;
              }
            }
          }
          
          if (totalPurchased + item.quantity > catalogItem.maxPerUser) {
            throw new Error(`Per-user lifetime limit exceeded for: ${catalogItem.name} (limit: ${catalogItem.maxPerUser}, you've ordered: ${totalPurchased})`);
          }
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
      }

      // Check balance
      if (currentBalance < totalCost) {
        throw new Error('Insufficient balance');
      }

      // Update catalog stock (only if needed)
      if (stockUpdates.size > 0) {
        const updatedCatalogItems = freshCatalogItems.map(item => {
          if (stockUpdates.has(item.id)) {
            return { ...item, stock: stockUpdates.get(item.id) };
          }
          return item;
        });

        tx.set(catalogRef, {
          items: updatedCatalogItems,
          version: Date.now(),
          lastUpdated: admin.firestore.Timestamp.now()
        }, { merge: true });
      }

      // Create order
      const orderId = generateOrderId();
      const newOrder = {
        id: orderId,
        items: orderItems,
        total: totalCost,
        status: 'pending',
        createdAt: Date.now(),
        fulfilledBy: null,
        fulfilledAt: null
      };

      // Add order to user's orders
      existingOrders.unshift(newOrder);

      tx.set(userOrdersRef, {
        orders: existingOrders,
        lastUpdated: admin.firestore.Timestamp.now()
      });

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
      const trimmedTransactions = transactions.slice(0, 100);
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

