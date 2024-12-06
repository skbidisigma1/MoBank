const fetch = require('node-fetch');

const { admin, db } = require('../firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(401).json({ message: 'Token verification failed' });
    }

    const user = await response.json();

    const period = parseInt(req.query.period, 10);

    if (!period || ![5, 6, 7].includes(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }

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

    res.status(200).json(names);
  } catch (error) {
    console.error('Get User Names Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
};
