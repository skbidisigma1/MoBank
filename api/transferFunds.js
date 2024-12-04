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
        return res.status(401).json({ message: 'Token verification failed' });
      }

      const senderUid = decoded.sub;

      let body = '';
      await new Promise((resolve) => {
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', resolve);
      });

      const { recipientName, recipientPeriod, amount } = JSON.parse(body);

      if (!recipientName || !recipientPeriod || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid input' });
      }

      try {
        const senderRef = db.collection('users').doc(senderUid);
        const recipientQuery = db
          .collection('users')
          .where('class_period', '==', parseInt(recipientPeriod, 10))
          .where('name', '==', recipientName);

        const [senderDoc, recipientSnapshot] = await Promise.all([
          senderRef.get(),
          recipientQuery.get(),
        ]);

        if (!senderDoc.exists) {
          return res.status(404).json({ message: 'Sender not found' });
        }

        if (recipientSnapshot.empty) {
          return res.status(404).json({ message: 'Recipient not found' });
        }

        const recipientDoc = recipientSnapshot.docs[0];
        const recipientRef = recipientDoc.ref;

        const senderData = senderDoc.data();
        const senderBalance = senderData.currency_balance || 0;

        if (senderBalance < amount) {
          return res.status(400).json({ message: 'Insufficient balance' });
        }

        const batch = db.batch();

        batch.update(senderRef, {
          currency_balance: admin.firestore.FieldValue.increment(-amount),
        });

        batch.update(recipientRef, {
          currency_balance: admin.firestore.FieldValue.increment(amount),
        });

        await batch.commit();

        return res.status(200).json({ message: 'Transfer successful' });
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  );
};
