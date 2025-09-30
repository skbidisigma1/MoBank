const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const { admin, db } = require('../firebase');

module.exports = async (req, res) => {
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

    const roles = decoded['https://mo-classroom.us/roles'] || [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

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

    const { name, period, amount, instrument } = bodyData;
    const numericAmount =
      typeof amount === 'string' ? Number(amount) : amount;

    if (!period || Number.isNaN(numericAmount)) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const formatMoBucks = v => {
      const abs = Math.abs(v);
      return `${abs} ${abs === 1 ? 'MoBuck' : 'MoBucks'}`;
    };

    const txn = v => ({
      type: v >= 0 ? 'credit' : 'debit',
      amount: Math.abs(v),
      counterpart: 'Admin',
      timestamp: admin.firestore.Timestamp.now(),
    });

    const note = (v, scope) => ({
      message:
        v >= 0
          ? `You received ${formatMoBucks(v)} from Admin${scope ? ` (${scope})` : ''}`
          : `You were charged ${formatMoBucks(v)} by Admin${scope ? ` (${scope})` : ''}`,
      type: 'admin_transfer',
      timestamp: admin.firestore.Timestamp.now(),
      read: false,
    });

    const updateLeaderboard = async p => {
      const snap = await db
        .collection('users')
        .where('class_period', '==', p)
        .get();

      const data = snap.docs
        .map(d => ({
          uid: d.id,
          name: d.data().name || 'Unknown User',
          balance: d.data().currency_balance || 0,
          instrument: d.data().instrument || 'N/A',
        }))
        .filter(u => u.name)
        .sort((a, b) => b.balance - a.balance);

      await db
        .collection('aggregates')
        .doc(`leaderboard_period_${p}`)
        .set(
          { leaderboardData: data, lastUpdated: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
    };

    if (name) {
      const query = db
        .collection('users')
        .where('class_period', '==', parseInt(period, 10))
        .where('name', '==', name);

      const snap = await query.get();
      if (snap.empty) {
        return res.status(404).json({ message: 'User not found' });
      }

      const userRef = snap.docs[0].ref;
      await db.runTransaction(async tx => {
        const doc = await tx.get(userRef);
        if (!doc.exists) throw new Error('User does not exist');

        let newBalance = (doc.data().currency_balance || 0) + numericAmount;
        if (newBalance > 100000000000) newBalance = 100000000000;
        if (newBalance < -100000000000) newBalance = -100000000000;

        const transactions = [txn(numericAmount), ...(doc.data().transactions || [])].slice(0, 5);
        const notifications = [
          ...(doc.data().notifications || []),
          note(numericAmount),
        ]
          .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
          .slice(0, 10);

        tx.update(userRef, {
          currency_balance: newBalance,
          transactions,
          notifications,
        });
      });

      await updateLeaderboard(parseInt(period, 10));
      return res.status(200).json({ message: 'Balance adjusted successfully' });
    }

    if (instrument) {
      const sectionSnap = await db
        .collection('users')
        .where('class_period', '==', parseInt(period, 10))
        .where('instrument', '==', instrument)
        .get();

      if (sectionSnap.empty) {
        return res
          .status(404)
          .json({ message: `No ${instrument} players found in period ${period}` });
      }

      await Promise.all(
        sectionSnap.docs.map(doc =>
          db.runTransaction(async tx => {
            const ref = doc.ref;
            const d = await tx.get(ref);
            if (!d.exists) throw new Error('User does not exist');

            let newBalance = (d.data().currency_balance || 0) + numericAmount;
            if (newBalance > 100000000000) newBalance = 100000000000;

            const transactions = [txn(numericAmount), ...(d.data().transactions || [])].slice(0, 5);
            const notifications = [
              ...(d.data().notifications || []),
              note(numericAmount, `${instrument} section`),
            ]
              .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
              .slice(0, 10);

            tx.update(ref, {
              currency_balance: newBalance,
              transactions,
              notifications,
            });
          })
        )
      );

      await updateLeaderboard(parseInt(period, 10));
      return res.status(200).json({ message: 'Balances updated successfully' });
    }

    const periodSnap = await db
      .collection('users')
      .where('class_period', '==', parseInt(period, 10))
      .get();

    if (periodSnap.empty) {
      return res.status(404).json({ message: 'No users found for this period' });
    }

    await Promise.all(
      periodSnap.docs.map(doc =>
        db.runTransaction(async tx => {
          const ref = doc.ref;
          const d = await tx.get(ref);
          if (!d.exists) throw new Error('User does not exist');

          let newBalance = (d.data().currency_balance || 0) + numericAmount;
          if (newBalance > 100000000000) newBalance = 100000000000;

          const transactions = [txn(numericAmount), ...(d.data().transactions || [])].slice(0, 5);
          const notifications = [
            ...(d.data().notifications || []),
            note(numericAmount, 'class-wide'),
          ]
            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
            .slice(0, 10);

          tx.update(ref, {
            currency_balance: newBalance,
            transactions,
            notifications,
          });
        })
      )
    );

    await updateLeaderboard(parseInt(period, 10));
    return res.status(200).json({ message: 'Balances updated successfully' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal Server Error', error: err.toString() });
    }
  }
};
