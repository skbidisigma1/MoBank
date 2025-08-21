const { getTokenFromHeader, verifyToken} = require('../auth-helper');
const { admin, db } = require('../firebase');
const { validateNotes, validateDate, ensureMinuteRange, buildSession, MAX_MINUTES, MAX_BACKDATE_DAYS } = require('./practiceUtils');
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
    const rawMinutes = Number(body.minutes ?? body.durationMinutes);
    let cleanMinutes; try { cleanMinutes = ensureMinuteRange(rawMinutes, MAX_MINUTES, true); } catch { return res.status(400).json({ message: 'Invalid minutes' }); }
    let useDate; try { useDate = validateDate((body.date || '').toString().trim()); } catch (e) {
        const map = { DATE_FMT:'Invalid date format', DATE_FUTURE:'Future date not allowed', DATE_PAST:`Date too far in past (max ${MAX_BACKDATE_DAYS} days)` };
        return res.status(400).json({ message: map[e.message] || 'Invalid date' });
    }
    let cleanedNotes; try { cleanedNotes = validateNotes(body.notes || ''); } catch { return res.status(400).json({ message: 'Notes too long' }); }
    const { session, nowTs } = buildSession({ minutes: cleanMinutes, dateStr: useDate, notes: cleanedNotes, manual: true });

    const userRef = db.collection('users').doc(uid);
    try {
        await db.runTransaction(async tx => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error('USER_MISSING');
            if (userSnap.data().class_period == null) throw new Error('PROFILE_INCOMPLETE');
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
                return;
            }
            const data = chunkSnap.data();
            const count = data.count || (data.sessions ? data.sessions.length : 0);
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
                const sessions = data.sessions || [];
                sessions.push(session);
                tx.update(chunkRef, {
                    sessions,
                    count: count + 1,
                    updatedAt: nowTs
                });
            }
        });
    } catch (e) {
        if (e.message === 'USER_MISSING') return res.status(404).json({ message: 'User not found' });
        if (e.message === 'PROFILE_INCOMPLETE') return res.status(428).json({ message: 'Set class period before logging practice' });
        console.error('logPracticeSession error', e);
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
    return res.status(200).json({
        message: 'Logged',
        session
    });
};