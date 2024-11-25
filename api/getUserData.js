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

  const uid = req.auth.payload.sub;

  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const publicData = userDoc.data();

    const privateDataRef = userRef.collection('privateData').doc('main');
    const privateDoc = await privateDataRef.get();

    if (!privateDoc.exists) {
      return res.status(404).json({ message: 'Private data not found' });
    }

    return res.status(200).json({
      ...publicData,
      privateData: privateDoc.data(),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
};