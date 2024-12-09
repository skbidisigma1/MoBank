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

      const uid = decoded.sub;

      let body = '';
      await new Promise((resolve) => {
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', resolve);
      });
      const requestBody = JSON.parse(body);

      const { class_period, instrument } = requestBody;

      const validClassPeriods = [5, 6, 7];
      const validInstruments = ['violin', 'viola', 'cello', 'bass'];

      if (!validClassPeriods.includes(class_period)) {
        return res.status(400).json({ message: 'Invalid class period' });
      }

      if (
        typeof instrument !== 'string' ||
        !validInstruments.includes(instrument.toLowerCase())
      ) {
        return res.status(400).json({ message: 'Invalid instrument' });
      }

      try {
        const userRef = db.collection('users').doc(uid);
        await userRef.set(
          {
            class_period,
            instrument: instrument.toLowerCase(),
          },
          { merge: true }
        );

        return res.status(200).json({ message: 'Profile updated successfully' });
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  );
};
