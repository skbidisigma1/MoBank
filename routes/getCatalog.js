const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const VALID_CLASS_PERIODS = require('../js/class-periods').map(period => period.value);

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
    const [userDoc, migrationLockDoc] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('maintenance').doc('classPeriodReset').get()
    ]);

    if (migrationLockDoc.exists && migrationLockDoc.data().status === 'running') {
      return res.status(503).json({
        code: 'MAINTENANCE',
        message: 'School-year setup is in progress. Please try again shortly.'
      });
    }

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userData = userDoc.data();
    const userPeriod = userData.class_period;

    if (!VALID_CLASS_PERIODS.includes(userPeriod)) {
      return res.status(409).json({
        code: 'PROFILE_INCOMPLETE',
        message: 'Please select your class period before using the store.'
      });
    }

    // Fetch catalog from single document
    const catalogDoc = await db.collection('store_catalog').doc('items').get();
    
    if (!catalogDoc.exists) {
      return res.status(200).json({ items: [], version: Date.now() });
    }

    const catalogData = catalogDoc.data();
    const allItems = Array.isArray(catalogData.items) ? catalogData.items : [];

    // Filter for enabled items and user's period
    const items = allItems.filter(item => {
      if (!item || typeof item.id !== 'string' || item.enabled === false) return false;
      if (!Number.isSafeInteger(item.price) || item.price < 0) return false;
      
      if (item.validPeriods != null && !Array.isArray(item.validPeriods)) return false;
      const validPeriods = item.validPeriods || [];
      // Include item if validPeriods is empty (all periods) or includes user's period
      return validPeriods.length === 0 || validPeriods.includes(userPeriod);
    });

    return res.status(200).json({ 
      items,
      version: catalogData.version || Date.now()
    });

  } catch (error) {
    console.error('getCatalog error:', error);
    return res.status(500).json({ message: 'Failed to fetch catalog' });
  }
};
