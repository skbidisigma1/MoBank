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

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        name: user.name || 'Unknown',
        instrument: '',
        class_period: null,
        currency_balance: 0,
      });
    }

    const privateDataRef = userRef.collection('privateData').doc('main');
    const privateDoc = await privateDataRef.get();

    return res.status(200).json({ message: 'User initialized successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
};
