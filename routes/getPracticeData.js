const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { db } = require('../firebase');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({
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

    let metaOnly = false;
    try {
        const q = req.url.split('?')[1] || '';
        metaOnly = /(^|&)meta=1(&|$)/.test(q);
    } catch {}

    const userRef = db.collection('users').doc(uid);
    try {
        const userSnap = await userRef.get();
        if (!userSnap.exists) return res.status(404).json({
            message: 'User not found'
        });
        const goal = userSnap.get('practice_goal') || 0;
        const lastIdx = userSnap.get('practice_last_chunk_index') || 0;
        if (metaOnly) {
            const lastSnap = await userRef.collection('practiceChunks').doc(String(lastIdx)).get();
            return res.status(200).json({
                goal,
                lastIndex: lastIdx,
                lastUpdated: lastSnap.exists ? (lastSnap.get('updatedAt') || null) : null
            });
        }
        const chunksSnap = await userRef.collection('practiceChunks').orderBy('index').get();
        const chunks = [];
        chunksSnap.forEach(d => {
            const data = d.data();
            chunks.push({
                index: data.index,
                sessions: Array.isArray(data.sessions) ? data.sessions : []
            });
        });
        return res.status(200).json({
            goal,
            chunks
        });
    } catch (e) {
        console.error('getPracticeData error', e);
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
};