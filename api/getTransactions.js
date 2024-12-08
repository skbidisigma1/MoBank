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
      return res.status(200).json({ transactions: [] });
    }

    const transactionsData = userDoc.data().transactions || [];
    const transactions = transactionsData.map(tx => ({
      type: tx.type,
      amount: tx.amount,
      timestamp: tx.timestamp ? tx.timestamp.toMillis() : null,
      counterpart: tx.counterpart || 'Unknown'
    }));

    res.status(200).json({ transactions });
  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
