const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const parseRequestBody = require('../request-body');

const VALID_CLASS_PERIODS = require('../js/class-periods').map(period => period.value);

const generateOrderId = () =>
  `order_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const profileIncompleteError = () => {
  const error = new Error('Please select your class period before using the store.');
  error.code = 'PROFILE_INCOMPLETE';
  return error;
};

const maintenanceError = () => {
  const error = new Error('School-year setup is in progress. Please try again shortly.');
  error.code = 'MAINTENANCE';
  return error;
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

  let bodyData;
  try {
    bodyData = await parseRequestBody(req);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const { items } = bodyData;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Invalid order: items array required' });
  }
  if (items.length > 20) {
    return res.status(400).json({ message: 'Order exceeds maximum of 20 items' });
  }

  // Normalize repeated IDs so stock, limits, and order details use one total per item.
  const quantitiesById = new Map();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ message: 'Invalid item format' });
    }
    const id = item.id.trim();
    const quantity = (quantitiesById.get(id) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) {
      return res.status(400).json({ message: 'Invalid item quantity' });
    }
    quantitiesById.set(id, quantity);
  }

  const admin = require('firebase-admin');
  const userRef = db.collection('users').doc(uid);
  const catalogRef = db.collection('store_catalog').doc('items');
  const userOrdersRef = db.collection('store_orders').doc(uid);
  const migrationLockRef = db.collection('maintenance').doc('classPeriodReset');

  try {
    const result = await db.runTransaction(async tx => {
      // Read all authoritative state before writing. In particular, price and
      // eligibility are checked against the same catalog version as stock.
      const [userDoc, userOrdersDoc, catalogDoc, migrationLockDoc] = await Promise.all([
        tx.get(userRef),
        tx.get(userOrdersRef),
        tx.get(catalogRef),
        tx.get(migrationLockRef)
      ]);

      if (migrationLockDoc.exists && migrationLockDoc.data().status === 'running') {
        throw maintenanceError();
      }

      if (!userDoc.exists) throw new Error('User not found');
      if (!catalogDoc.exists) throw new Error('Catalog not found');

      const userData = userDoc.data();
      const userPeriod = userData.class_period;
      if (!VALID_CLASS_PERIODS.includes(userPeriod)) throw profileIncompleteError();

      const currentBalance = Number(userData.currency_balance || 0);
      if (!Number.isFinite(currentBalance) || currentBalance < 0 ||
          currentBalance > Number.MAX_SAFE_INTEGER) {
        throw new Error('Invalid user balance');
      }
      const ordersValue = userOrdersDoc.exists ? userOrdersDoc.data().orders : [];
      const existingOrders = Array.isArray(ordersValue) ? ordersValue : [];
      if (existingOrders.length >= 1200) {
        throw new Error('Order limit reached. Please contact an administrator.');
      }

      const catalogValue = catalogDoc.data().items;
      const catalogItems = Array.isArray(catalogValue) ? catalogValue : [];
      const catalogMap = new Map(catalogItems.map(item => [item?.id, item]));
      const orderItems = [];
      const stockUpdates = new Map();
      let totalCost = 0;

      for (const [itemId, quantity] of quantitiesById) {
        const catalogItem = catalogMap.get(itemId);
        if (!catalogItem) throw new Error(`Item not found: ${itemId}`);
        if (catalogItem.enabled === false) {
          throw new Error(`Item unavailable: ${catalogItem.name || itemId}`);
        }
        if (!Number.isSafeInteger(catalogItem.price) || catalogItem.price < 0) {
          throw new Error(`Item unavailable: ${catalogItem.name || itemId}`);
        }

        const validPeriods = catalogItem.validPeriods == null ? [] : catalogItem.validPeriods;
        if (!Array.isArray(validPeriods) ||
            (validPeriods.length > 0 && !validPeriods.includes(userPeriod))) {
          throw new Error(`Item not available for your class period: ${catalogItem.name || itemId}`);
        }

        if (catalogItem.stock != null) {
          if (!Number.isSafeInteger(catalogItem.stock) || catalogItem.stock < 0) {
            throw new Error(`Item unavailable: ${catalogItem.name || itemId}`);
          }
          if (catalogItem.stock < quantity) {
            throw new Error(`Insufficient stock for: ${catalogItem.name || itemId}`);
          }
          stockUpdates.set(itemId, catalogItem.stock - quantity);
        }

        if (catalogItem.maxPerUser != null) {
          if (!Number.isSafeInteger(catalogItem.maxPerUser) || catalogItem.maxPerUser < 1) {
            throw new Error(`Item unavailable: ${catalogItem.name || itemId}`);
          }
          let totalPurchased = 0;
          for (const order of existingOrders) {
            if (order?.status !== 'fulfilled' && order?.status !== 'pending') continue;
            const matchingItems = Array.isArray(order.items)
              ? order.items.filter(orderItem => orderItem?.id === itemId)
              : [];
            for (const orderItem of matchingItems) {
              if (Number.isSafeInteger(orderItem.quantity) && orderItem.quantity > 0) {
                totalPurchased += orderItem.quantity;
              }
            }
          }
          if (totalPurchased + quantity > catalogItem.maxPerUser) {
            throw new Error(
              `Per-user lifetime limit exceeded for: ${catalogItem.name || itemId} ` +
              `(limit: ${catalogItem.maxPerUser}, you've ordered: ${totalPurchased})`
            );
          }
        }

        const itemTotal = catalogItem.price * quantity;
        if (!Number.isSafeInteger(itemTotal) || !Number.isSafeInteger(totalCost + itemTotal)) {
          throw new Error('Order total is too large');
        }
        totalCost += itemTotal;
        orderItems.push({
          id: itemId,
          name: catalogItem.name,
          price: catalogItem.price,
          quantity,
          total: itemTotal
        });
      }

      if (currentBalance < totalCost) throw new Error('Insufficient balance');

      if (stockUpdates.size > 0) {
        const updatedCatalogItems = catalogItems.map(item => (
          stockUpdates.has(item?.id) ? { ...item, stock: stockUpdates.get(item.id) } : item
        ));
        tx.set(catalogRef, {
          items: updatedCatalogItems,
          version: Date.now(),
          lastUpdated: admin.firestore.Timestamp.now()
        }, { merge: true });
      }

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
      existingOrders.unshift(newOrder);
      tx.set(userOrdersRef, {
        orders: existingOrders,
        lastUpdated: admin.firestore.Timestamp.now()
      });

      const newBalance = currentBalance - totalCost;
      const transaction = {
        type: 'debit',
        amount: totalCost,
        counterpart: 'MoStore',
        timestamp: admin.firestore.Timestamp.now(),
        orderId
      };
      const transactions = Array.isArray(userData.transactions) ? userData.transactions : [];
      transactions.unshift(transaction);

      const notification = {
        type: 'store_order',
        message: `Order placed: ${orderItems.length} ${orderItems.length === 1 ? 'item' : 'items'} for $${totalCost.toLocaleString()}. Pending fulfillment.`,
        timestamp: admin.firestore.Timestamp.now(),
        read: false,
        orderId
      };
      const notifications = Array.isArray(userData.notifications) ? userData.notifications : [];
      notifications.unshift(notification);
      const trimmedNotifications = notifications.slice(0, 10).sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return bTime - aTime;
      });

      tx.update(userRef, {
        currency_balance: newBalance,
        transactions: transactions.slice(0, 100),
        notifications: trimmedNotifications
      });

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
    if (error.code === 'PROFILE_INCOMPLETE') {
      return res.status(409).json({ code: error.code, message: error.message });
    }
    if (error.code === 'MAINTENANCE') {
      return res.status(503).json({ code: error.code, message: error.message });
    }

    const message = String(error.message || '');
    if (/not found|unavailable|Insufficient|limit|Invalid|period|too large/i.test(message)) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message: 'Failed to place order' });
  }
};
