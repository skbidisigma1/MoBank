const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { admin, db } = require('../firebase');

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(
    token,
    getKey,
    {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    },
    async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Token verification failed', error: err.toString() });
      }

      const roles = decoded['https://mo-classroom.us/roles'] || [];
      if (!roles.includes('admin')) {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
      }      const period = parseInt(req.query.period, 10);
      const validPeriods = [5, 6, 7, 8, 9, 10];
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
    }
  );
};
