const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { db, admin } = require('../firebase');
const { validateNotes, validateDate, ensureMinuteRange, MAX_MINUTES, MAX_BACKDATE_DAYS } = require('./practiceUtils');

// Edit an existing practice session by sid.
// Body: { sid, minutes?, notes?, date? }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
  const uid = decoded.sub;

  const body = req.body || {};
  const sid = (body.sid || '').toString().trim();
  if (!sid) return res.status(400).json({ message: 'Missing sid' });

  let setMinutes = null; if (body.minutes != null || body.durationMinutes != null) {
    try { setMinutes = ensureMinuteRange(Number(body.minutes ?? body.durationMinutes), MAX_MINUTES, true); } catch { return res.status(400).json({ message: 'Invalid minutes' }); }
  }
  let setNotes = null; if (body.notes != null) {
    try { setNotes = validateNotes(body.notes); } catch { return res.status(400).json({ message: 'Notes too long' }); }
  }
  let setDate = null; if (body.date != null) {
    try { setDate = validateDate((body.date || '').toString().trim()); } catch (e) {
      const map = { DATE_FMT:'Invalid date format', DATE_FUTURE:'Future date not allowed', DATE_PAST:`Date too far in past (max ${MAX_BACKDATE_DAYS} days)` };
      return res.status(400).json({ message: map[e.message] || 'Invalid date' });
    }
  }
  if (setMinutes == null && setNotes == null && setDate == null) return res.status(400).json({ message: 'No changes supplied' });

  const userRef = db.collection('users').doc(uid);
  let updatedSession = null;
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
        const target = sessions.find(s => s.sid === sid);
        if (!target) continue;
        if (setMinutes != null) target.m = setMinutes;
        if (setNotes != null) { if (setNotes) target.n = setNotes; else delete target.n; }
        if (setDate != null) target.d = setDate;
        tx.update(chunkRef, { sessions, updatedAt: admin.firestore.Timestamp.now() });
        updatedSession = target;
        return;
      }
      if (!updatedSession) throw new Error('NOT_FOUND');
    });
  } catch (e) {
    if (e.message === 'USER_MISSING') return res.status(404).json({ message: 'User not found' });
    if (e.message === 'NOT_FOUND') return res.status(404).json({ message: 'Session not found' });
    console.error('editPracticeSession error', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
  return res.status(200).json({ message: 'Updated', session: updatedSession });
};