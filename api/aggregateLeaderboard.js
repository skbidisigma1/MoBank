const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
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
    const roles = user['https://mo-classroom.us/roles'] || [];

    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const leaderboardData = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const period = data.class_period || 'Unknown';
      if (!leaderboardData[period]) {
        leaderboardData[period] = [];
      }
      leaderboardData[period].push({
        uid: doc.id,
        name: data.name || 'Unknown User',
        balance: data.currency_balance || 0,
        instrument: data.instrument || 'N/A',
      });
    });

    Object.keys(leaderboardData).forEach((period) => {
      leaderboardData[period].sort((a, b) => b.balance - a.balance);
    });

    const aggregateRef = db.collection('aggregates').doc('leaderboard');
    await aggregateRef.set({
      leaderboardData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: 'Leaderboard aggregated successfully' });
  } catch (error) {
    console.error('Aggregate Leaderboard Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
