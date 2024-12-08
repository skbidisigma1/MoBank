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

    const docRef = db.collection('aggregates').doc(`leaderboard_period_${period}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Leaderboard data not found' });
    }

    const data = doc.data();
    const cleanedLeaderboardData = data.leaderboardData.map(({ uid, ...rest }) => rest);

    return res.status(200).json({
      lastUpdated: data.lastUpdated,
      leaderboardData: cleanedLeaderboardData,
    });
  } catch (error) {
    console.error('Error fetching aggregated leaderboard:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
