const fetch = require('node-fetch');

const { admin, db } = require('../firebase');

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
    const uid = user.sub;

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

    if (!validInstruments.includes(instrument.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid instrument' });
    }

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
};
