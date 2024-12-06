const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

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

      const user = decoded;
      const roles = user['https://mo-classroom.us/roles'] || [];
      if (!roles.includes('admin')) {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
      }

      let body = '';
      await new Promise((resolve) => {
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', resolve);
      });

      const { name, period, amount } = JSON.parse(body);

      if (!name || !period || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid input' });
      }

      try {
        const usersRef = db.collection('users');
        const query = usersRef
          .where('class_period', '==', parseInt(period, 10))
          .where('name', '==', name);

        const snapshot = await query.get();

        if (snapshot.empty) {
          return res.status(404).json({ message: 'User not found' });
        }

        const userDoc = snapshot.docs[0];
        const userRef = userDoc.ref;

        await userRef.update({
          currency_balance: admin.firestore.FieldValue.increment(amount),
        });

        return res.status(200).json({ message: 'Balance adjusted successfully' });
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
      }
    }
  );
};
