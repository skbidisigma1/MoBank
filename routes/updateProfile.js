const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const parseRequestBody = require('../request-body');
const validClassPeriods = require('../js/class-periods').map(period => period.value);

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

  const { class_period, instrument, theme } = bodyData;

  const cp = typeof class_period === 'number'
    ? class_period
    : typeof class_period === 'string' && /^\d+$/.test(class_period)
      ? Number(class_period)
      : NaN;
  const validInstruments = ['violin', 'viola', 'cello', 'bass', 'other'];
  const validThemes = ['light', 'dark'];

  if (!validClassPeriods.includes(cp)) {
    return res.status(400).json({ message: 'Invalid class period' });
  }
  if (
    typeof instrument !== 'string' ||
    !validInstruments.includes(instrument.toLowerCase())
  ) {
    return res.status(400).json({ message: 'Invalid instrument' });
  }
  if (
    typeof theme !== 'string' ||
    !validThemes.includes(theme.toLowerCase())
  ) {
    return res.status(400).json({ message: 'Invalid theme' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const migrationLockRef = db.collection('maintenance').doc('classPeriodReset');
    await db.runTransaction(async tx => {
      const migrationLock = await tx.get(migrationLockRef);
      if (migrationLock.exists && migrationLock.data().status === 'running') {
        throw new Error('SCHOOL_YEAR_SETUP_IN_PROGRESS');
      }
      tx.set(userRef, {
        class_period: cp,
        instrument: instrument.toLowerCase(),
        theme: theme.toLowerCase(),
      }, { merge: true });
    });
    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    if (error.message === 'SCHOOL_YEAR_SETUP_IN_PROGRESS') {
      return res.status(503).json({ message: 'School-year setup is in progress. Please try again shortly.' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
