const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const { admin, db } = require('../firebase');
const parseRequestBody = require('../request-body');
const { MOBANK_MAX_BALANCE } = require('../js/balance-limits');
const validClassPeriods = require('../js/class-periods').map(({ value }) => value);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }

  const senderUid = decoded.sub;
  let bodyData;
  try {
    bodyData = await parseRequestBody(req);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const recipientUid =
    typeof bodyData.recipientUid === 'string'
      ? bodyData.recipientUid.trim()
      : '';
  const { amount } = bodyData;
  const numericAmount =
    typeof amount === 'number'
      ? amount
      : typeof amount === 'string' && /^\d+$/.test(amount)
        ? Number(amount)
        : NaN;

  if (
    !recipientUid ||
    !Number.isSafeInteger(numericAmount) ||
    numericAmount <= 0
  ) {
    return res.status(400).json({ message: 'Invalid recipient or amount' });
  }

  if (senderUid === recipientUid) {
    return res.status(400).json({ message: 'Self-transfers are not allowed.' });
  }

  const senderRef = db.collection('users').doc(senderUid);
  const recipientRef = db.collection('users').doc(recipientUid);
  const migrationLockRef = db.collection('maintenance').doc('classPeriodReset');

  try {
    const senderUserData = await db.runTransaction(async tx => {
      const [senderSnap, recipientSnap, migrationLockSnap] = await Promise.all([
        tx.get(senderRef),
        tx.get(recipientRef),
        tx.get(migrationLockRef),
      ]);

      if (migrationLockSnap.exists && migrationLockSnap.data().status === 'running') {
        throw new Error('SCHOOL_YEAR_SETUP_IN_PROGRESS');
      }

      if (!senderSnap.exists) {
        throw new Error('SENDER_NOT_FOUND');
      }
      if (!recipientSnap.exists) {
        throw new Error('RECIPIENT_NOT_FOUND');
      }

      const senderData = senderSnap.data();
      const recipientData = recipientSnap.data();
      if (!validClassPeriods.includes(senderData.class_period)) {
        throw new Error('PROFILE_INCOMPLETE');
      }
      if (!validClassPeriods.includes(recipientData.class_period)) {
        throw new Error('RECIPIENT_INCOMPLETE');
      }
      if (senderData.class_period !== recipientData.class_period) {
        throw new Error('RECIPIENT_DIFFERENT_PERIOD');
      }

      const senderBalanceValue = Number(senderData.currency_balance);
      const recipientBalanceValue = Number(recipientData.currency_balance);
      const senderBalance = Number.isFinite(senderBalanceValue) ? senderBalanceValue : 0;
      const recipientBalance = Number.isFinite(recipientBalanceValue) ? recipientBalanceValue : 0;
      if (senderBalance < numericAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      const updatedSenderBalance = senderBalance - numericAmount;
      const updatedRecipientBalance = recipientBalance + numericAmount;
      if (!Number.isFinite(updatedSenderBalance) || !Number.isFinite(updatedRecipientBalance) ||
          Math.abs(updatedSenderBalance) > Number.MAX_SAFE_INTEGER ||
          Math.abs(updatedRecipientBalance) > Number.MAX_SAFE_INTEGER) {
        throw new Error('INVALID_BALANCE');
      }
      if (updatedRecipientBalance > MOBANK_MAX_BALANCE) {
        throw new Error('RECIPIENT_BALANCE_LIMIT');
      }
      const timestamp = admin.firestore.Timestamp.now();
      const senderHistory = Array.isArray(senderData.transactions) ? senderData.transactions : [];
      const recipientHistory = Array.isArray(recipientData.transactions) ? recipientData.transactions : [];
      const senderTransactions = [
        {
          type: 'debit',
          amount: numericAmount,
          counterpart: recipientData.name || 'Unknown User',
          timestamp,
        },
        ...senderHistory,
      ].slice(0, 100);
      const recipientTransactions = [
        {
          type: 'credit',
          amount: numericAmount,
          counterpart: senderData.name || 'Unknown Sender',
          timestamp,
        },
        ...recipientHistory,
      ].slice(0, 100);

      const mobucksText = value =>
        `${value} ${value === 1 ? 'MoBuck' : 'MoBucks'}`;
      const newNote = {
        message: `You received ${mobucksText(numericAmount)} from ${
          senderData.name || 'Unknown Sender'
        }`,
        type: 'user_transfer',
        timestamp,
        read: false,
      };
      const notifications = Array.isArray(recipientData.notifications)
        ? [...recipientData.notifications]
        : [];
      const timestampMillis = item => item?.timestamp?.toMillis?.() || 0;
      const recipientNotifications = [...notifications, newNote]
        .sort((a, b) => timestampMillis(b) - timestampMillis(a))
        .slice(0, 10);

      tx.update(senderRef, {
        currency_balance: updatedSenderBalance,
        transactions: senderTransactions,
      });
      tx.update(recipientRef, {
        currency_balance: updatedRecipientBalance,
        transactions: recipientTransactions,
        notifications: recipientNotifications,
      });

      return {
        ...senderData,
        currency_balance: updatedSenderBalance,
        transactions: senderTransactions,
      };
    });

    return res.status(200).json({
      message: 'Transfer successful',
      userData: senderUserData,
    });
  } catch (err) {
    if (err.message === 'SCHOOL_YEAR_SETUP_IN_PROGRESS') {
      return res.status(503).json({
        message: 'School-year setup is in progress. Please try again shortly.',
      });
    }
    if (err.message === 'SENDER_NOT_FOUND') {
      return res.status(404).json({ message: 'Sender not found' });
    }
    if (err.message === 'RECIPIENT_NOT_FOUND') {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    if (err.message === 'INVALID_BALANCE') {
      return res.status(409).json({ message: 'A user balance is invalid or outside the supported range.' });
    }
    if (err.message === 'RECIPIENT_BALANCE_LIMIT') {
      return res.status(409).json({ message: 'The recipient is at the maximum supported balance.' });
    }
    if (err.message === 'PROFILE_INCOMPLETE') {
      return res.status(428).json({
        message: 'Complete your profile (class period) before transferring.',
      });
    }
    if (err.message === 'RECIPIENT_INCOMPLETE') {
      return res.status(409).json({
        message: 'Recipient has not completed profile yet.',
      });
    }
    if (err.message === 'RECIPIENT_DIFFERENT_PERIOD') {
      return res.status(409).json({
        message: 'Recipient is no longer in your class period. Choose someone from the updated list.',
      });
    }
    console.error(err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
