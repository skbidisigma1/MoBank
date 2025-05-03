const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const { admin, db } = require('../firebase');

const profiler = {
  startTime: {},
  start(label) {
    this.startTime[label] = process.hrtime();
  },
  end(label) {
    const diff = process.hrtime(this.startTime[label]);
    return (diff[0] * 1e9 + diff[1]) / 1e6; // ms
  },
};

module.exports = async (req, res) => {
  profiler.start('transfer-funds-total');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = await verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Token verification failed' });
    }

    const senderUid = decoded.sub;

    let bodyData = {};
    if (req.body && Object.keys(req.body).length) {
      bodyData = req.body;
    } else {
      let raw = '';
      await new Promise((resolve, reject) => {
        req.on('data', chunk => (raw += chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });
      try {
        bodyData = JSON.parse(raw || '{}');
      } catch {
        return res.status(400).json({ message: 'Invalid JSON' });
      }
    }

    const { recipientName, amount } = bodyData;
    const numericAmount =
      typeof amount === 'string' ? Number(amount) : amount;

    if (!recipientName || !numericAmount || numericAmount <= 0) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const senderRef = db.collection('users').doc(senderUid);
    const recipientQuery = db
      .collection('users')
      .where('name', '==', recipientName);

    const [senderDoc, recipientSnap] = await Promise.all([
      senderRef.get(),
      recipientQuery.get(),
    ]);

    if (!senderDoc.exists) {
      return res.status(404).json({ message: 'Sender not found' });
    }
    if (recipientSnap.empty) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const recipientDoc = recipientSnap.docs[0];
    const recipientUid = recipientDoc.id;
    const recipientRef = recipientDoc.ref;

    if (senderUid === recipientUid) {
      return res.status(400).json({ message: 'Self-transfers are not allowed.' });
    }

    const senderData = senderDoc.data();
    const senderBalance = senderData.currency_balance || 0;
    if (senderBalance < numericAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    try {
      await db.runTransaction(async tx => {
        const [sSnap, rSnap] = await Promise.all([
          tx.get(senderRef),
          tx.get(recipientRef),
        ]);
        if (!sSnap.exists || !rSnap.exists) {
          throw new Error('User does not exist');
        }

        const updatedSenderBalance =
          (sSnap.data().currency_balance || 0) - numericAmount;
        if (updatedSenderBalance < 0) {
          throw new Error('Insufficient balance');
        }

        tx.update(senderRef, {
          currency_balance: updatedSenderBalance,
        });
        tx.update(recipientRef, {
          currency_balance:
            (rSnap.data().currency_balance || 0) + numericAmount,
        });

        const mobucksText = v =>
          `${v} ${v === 1 ? 'MoBuck' : 'MoBucks'}`;

        const sTx = [
          {
            type: 'debit',
            amount: numericAmount,
            counterpart: recipientName,
            timestamp: admin.firestore.Timestamp.now(),
          },
          ...(sSnap.data().transactions || []),
        ].slice(0, 5);
        tx.update(senderRef, { transactions: sTx });

        const rTx = [
          {
            type: 'credit',
            amount: numericAmount,
            counterpart: senderData.name || 'Unknown',
            timestamp: admin.firestore.Timestamp.now(),
          },
          ...(rSnap.data().transactions || []),
        ].slice(0, 5);
        tx.update(recipientRef, { transactions: rTx });

        const newNote = {
          message: `You received ${mobucksText(
            numericAmount,
          )} from ${senderData.name ?? 'Unknown Sender'}`,
          type: 'user_transfer',
          timestamp: admin.firestore.Timestamp.now(),
          read: false,
        };

        const rNotes = [
          ...(rSnap.data().notifications || []),
          newNote,
        ]
          .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
          .slice(0, 10);

        tx.update(recipientRef, { notifications: rNotes });
      });

      profiler.end('transfer-funds-total');
      return res.status(200).json({ message: 'Transfer successful' });
    } catch (err) {
      if (err.message === 'Insufficient balance') {
        return res.status(400).json({ message: 'Insufficient balance' });
      }
      console.error(err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unexpected server error' });
  }
};