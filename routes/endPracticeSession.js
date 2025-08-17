const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { admin, db } = require('../firebase');
const { validateNotes, validateDate, buildSession, MAX_MINUTES, MAX_BACKDATE_DAYS } = require('./practiceUtils');
const CHUNK_ROTATE_COUNT = 1500;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({
        message: 'Method not allowed'
    });
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({
        message: 'Unauthorized'
    });
    let decoded;
    try {
        decoded = await verifyToken(token);
    } catch {
        return res.status(401).json({
            message: 'Token verification failed'
        });
    }
    const uid = decoded.sub;
    const body = req.body || {};
    const reportedMinutes = Number(body.durationMinutes ?? body.minutes); // for client display only; server derives authoritative
    const notesRaw = (body.notes || '').toString();
    const dateStrRaw = (body.date || '').toString().trim();
    const sessionId = (body.sessionId || '').toString().trim();
    if (!sessionId) return res.status(400).json({
        message: 'Missing sessionId'
    });
    // Basic reported range guard (still derive authoritative below)
    if (!reportedMinutes || reportedMinutes <= 0 || !Number.isFinite(reportedMinutes) || reportedMinutes > MAX_MINUTES) return res.status(400).json({ message: 'Invalid minutes' });
    let useDate;
    try { useDate = validateDate(dateStrRaw); } catch (e) {
        const map = { DATE_FMT:'Invalid date format', DATE_FUTURE:'Future date not allowed', DATE_PAST:`Date too far in past (max ${MAX_BACKDATE_DAYS} days)` };
        return res.status(400).json({ message: map[e.message] || 'Invalid date' });
    }
    let cleanedNotes;
    try { cleanedNotes = validateNotes(notesRaw); } catch (e) { return res.status(400).json({ message: 'Notes too long' }); }
    const nowTs = admin.firestore.Timestamp.now();
    let session;
    const userRef = db.collection('users').doc(uid);
    try {
        await db.runTransaction(async tx => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error('USER_MISSING');
            const active = userSnap.get('practice_active_session');
            if (!active || active.sid !== sessionId) throw new Error('ACTIVE_MISMATCH');
            // Derive authoritative elapsed (ceil to minutes). Reject < 60s total.
            let elapsedMinutes = 0;
            const startedAt = active.startedAt;
            if (startedAt && (startedAt._seconds || startedAt.seconds)) {
                const startMs = (startedAt._seconds || startedAt.seconds) * 1000;
                const elapsedMs = Date.now() - startMs;
                if (elapsedMs < 60 * 1000) throw new Error('TOO_SHORT');
                elapsedMinutes = Math.ceil(elapsedMs / 60000);
            } else {
                // Fallback to reported, still enforce >=1
                if (reportedMinutes < 1) throw new Error('TOO_SHORT');
                elapsedMinutes = Math.round(reportedMinutes);
            }
            if (elapsedMinutes > MAX_MINUTES) elapsedMinutes = MAX_MINUTES; // clamp
            const { session: built } = buildSession({ minutes: elapsedMinutes, dateStr: useDate, notes: cleanedNotes, manual: false, sid: sessionId });
            session = built;
            let lastIdx = userSnap.get('practice_last_chunk_index');
            if (lastIdx === undefined || lastIdx === null) lastIdx = 0;
            const chunkRef = userRef.collection('practiceChunks').doc(String(lastIdx));
            let chunkSnap = await tx.get(chunkRef);
            if (!chunkSnap.exists) {
                tx.set(chunkRef, {
                    index: lastIdx,
                    sessions: [session],
                    count: 1,
                    createdAt: nowTs,
                    updatedAt: nowTs
                });
                if (userSnap.get('practice_last_chunk_index') !== lastIdx) tx.update(userRef, {
                    practice_last_chunk_index: lastIdx
                });
                tx.update(userRef, { practice_active_session: admin.firestore.FieldValue.delete() });
                return;
            }
            const data = chunkSnap.data();
            const sessions = data.sessions || [];
            if (sessions.some(s => s.sid && s.sid === sessionId)) throw new Error('DUPLICATE_SID');
            const count = data.count || sessions.length;
            if (count >= CHUNK_ROTATE_COUNT) {
                const newIdx = lastIdx + 1;
                const newRef = userRef.collection('practiceChunks').doc(String(newIdx));
                tx.set(newRef, {
                    index: newIdx,
                    sessions: [session],
                    count: 1,
                    createdAt: nowTs,
                    updatedAt: nowTs
                });
                tx.update(userRef, {
                    practice_last_chunk_index: newIdx
                });
            } else {
                sessions.push(session);
                tx.update(chunkRef, { sessions, count: count + 1, updatedAt: nowTs });
            }
            tx.update(userRef, { practice_active_session: admin.firestore.FieldValue.delete() });
        });
    } catch (e) {
        if (e.message === 'USER_MISSING') return res.status(404).json({
            message: 'User not found'
        });
        if (e.message === 'DUPLICATE_SID') return res.status(409).json({
            message: 'Duplicate session'
        });
    if (e.message === 'ACTIVE_MISMATCH') return res.status(409).json({ message: 'Session mismatch or not active' });
    if (e.message === 'TOO_SHORT') return res.status(400).json({ message: 'Session too short (minimum 1 full minute).' });
        console.error('endPracticeSession error', e);
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
    return res.status(200).json({
        message: 'Saved',
        session
    });
};