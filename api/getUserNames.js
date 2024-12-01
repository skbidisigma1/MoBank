const admin = require('firebase-admin');

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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
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
