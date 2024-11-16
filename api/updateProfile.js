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
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    })
  });
}

const db = admin.firestore();
const COOLDOWN_SECONDS = 60;

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
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      return res.status(401).json({ message: 'Token verification failed' });
    }

    const user = await response.json();
    const uid = user.sub;

    const userCooldownDoc = db.collection('cooldowns').doc(uid);
    const now = admin.firestore.Timestamp.now();

    const userCooldownSnapshot = await userCooldownDoc.get();
    if (userCooldownSnapshot.exists) {
      const lastRequestTime = userCooldownSnapshot.data().lastRequest;
      const secondsSinceLastRequest = now.seconds - lastRequestTime.seconds;

      if (secondsSinceLastRequest < COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: `Please wait ${COOLDOWN_SECONDS - secondsSinceLastRequest} seconds before trying again.`,
          waitTime: COOLDOWN_SECONDS - secondsSinceLastRequest
        });
      }
    }

    await userCooldownDoc.set({ lastRequest: now });

    let body = '';
    await new Promise((resolve) => {
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', resolve);
    });
    const requestBody = JSON.parse(body);

    const { class_period, instrument } = requestBody;

    const validClassPeriods = [1, 3, 4, 5, 6, 7];
    const validInstruments = ['violin', 'viola', 'cello', 'bass'];

    if (!validClassPeriods.includes(class_period)) {
      return res.status(400).json({ message: 'Invalid class period' });
    }

    if (!validInstruments.includes(instrument)) {
      return res.status(400).json({ message: 'Invalid instrument' });
    }

    const publicDataRef = db.collection('users').doc(uid).collection('publicData').doc('main');
    await publicDataRef.set(
      {
        class_period,
        instrument
      },
      { merge: true }
    );

    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
};