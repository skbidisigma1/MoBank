
const { admin, db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

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
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed', error: err.toString() });
  }

  const roles = decoded['https://mo-classroom.us/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  const period = parseInt(req.query.period, 10);
  const validPeriods = [4, 5, 6, 7, 8, 10];
  if (!period || !validPeriods.includes(period)) {
    return res.status(400).json({ message: 'Invalid period' });
  }

  try {
    const usersRef = db.collection('users').where('class_period', '==', period);
    const snapshot = await usersRef.get();
    const userData = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name || 'Unknown User',
          balance: data.currency_balance || 0,
          instrument: data.instrument || 'N/A',
        };
      })
      .filter((user) => user.name);
    const leaderboardData = userData.sort((a, b) => b.balance - a.balance);
    const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`);
    await aggregateRef.set(
      {
        leaderboardData: leaderboardData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    const names = userData.map((user) => user.name);
    return res.status(200).json(names);
  } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
};
