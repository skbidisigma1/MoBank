const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { admin, db } = require('../firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
  const uid = decoded.sub;

  const userRef = db.collection('users').doc(uid);
  const nowTs = admin.firestore.Timestamp.now();
  let payloadOut = null;
  try {
    await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('USER_MISSING');
      const active = userSnap.get('practice_active_session');
      if (active && active.sid) {
        payloadOut = { sid: active.sid, startedAt: active.startedAt || nowTs, existing: true };
        return;
      }
      const sid = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
      const newActive = { sid, startedAt: nowTs };
      tx.update(userRef, { practice_active_session: newActive });
      payloadOut = { sid, startedAt: nowTs, existing: false };
    });
  } catch (e) {
    if (e.message === 'USER_MISSING') return res.status(404).json({ message: 'User not found' });
    console.error('startPracticeSession error', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
  return res.status(200).json({ message: 'Started', ...payloadOut });
};
