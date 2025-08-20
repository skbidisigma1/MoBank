const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { db, admin } = require('../firebase');

// Delete a practice session by sid.
// Body: { sid }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
  const uid = decoded.sub;
  const body = req.body || {};
  const sid = (body.sid || '').toString().trim();
  if (!sid) return res.status(400).json({ message: 'Missing sid' });

  const userRef = db.collection('users').doc(uid);
  let deleted = false;
  try {
    await db.runTransaction(async tx => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('USER_MISSING');
      const lastIdx = userSnap.get('practice_last_chunk_index') || 0;
      for (let idx = lastIdx; idx >= 0; idx--) {
        const chunkRef = userRef.collection('practiceChunks').doc(String(idx));
        const chunkSnap = await tx.get(chunkRef);
        if (!chunkSnap.exists) continue;
        const data = chunkSnap.data();
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];
        const newSessions = sessions.filter(s => s.sid !== sid);
        if (newSessions.length === sessions.length) continue;
        tx.update(chunkRef, { sessions: newSessions, count: (data.count || sessions.length) - 1, updatedAt: admin.firestore.Timestamp.now() });
        deleted = true;
        return;
      }
      if (!deleted) throw new Error('NOT_FOUND');
    });
  } catch (e) {
    if (e.message === 'USER_MISSING') return res.status(404).json({ message: 'User not found' });
    if (e.message === 'NOT_FOUND') return res.status(404).json({ message: 'Session not found' });
    console.error('deletePracticeSession error', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
  return res.status(200).json({ message: 'Deleted', sid });
};