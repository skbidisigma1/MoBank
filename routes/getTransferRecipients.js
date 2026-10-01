const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const { db } = require('../firebase');
const validClassPeriods = require('../js/class-periods').map(({ value }) => value);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }

  try {
    const senderUid = decoded.sub;
    const senderRef = db.collection('users').doc(senderUid);
    const result = await db.runTransaction(async tx => {
      const [senderSnap, migrationLockSnap] = await Promise.all([
        tx.get(senderRef),
        tx.get(db.collection('maintenance').doc('classPeriodReset')),
      ]);

      if (migrationLockSnap.exists && migrationLockSnap.data().status === 'running') {
        const error = new Error('SCHOOL_YEAR_SETUP_IN_PROGRESS');
        error.code = 503;
        throw error;
      }
      if (!senderSnap.exists) {
        const error = new Error('User not found');
        error.code = 404;
        throw error;
      }

      const period = senderSnap.data().class_period;
      if (!validClassPeriods.includes(period)) {
        const error = new Error('Complete your profile (class period) before transferring.');
        error.code = 428;
        throw error;
      }

      const usersSnap = await tx.get(
        db.collection('users').where('class_period', '==', period)
      );
      const recipients = usersSnap.docs
        .filter(doc => doc.id !== senderUid)
        .map(doc => ({ uid: doc.id, name: doc.data().name }))
        .filter(user => typeof user.name === 'string' && user.name.trim())
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      return { period, recipients };
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 503 || err.code === 404 || err.code === 428) {
      return res.status(err.code).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
