const { admin, db } = require('../firebase');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
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
      return res.status(404).json({ message: 'User not found' });
    }

    const transactionsRef = userRef.collection('transactions').orderBy('timestamp', 'desc').limit(5);
    const snapshot = await transactionsRef.get();
    const transactions = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        type: data.type,
        amount: data.amount,
        timestamp: data.timestamp ? data.timestamp.toMillis() : null,
        counterpart: data.counterpart || 'Unknown'
      };
    });

    res.status(200).json({ transactions });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
