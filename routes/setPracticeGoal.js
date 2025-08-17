const { getTokenFromHeader, verifyToken} = require('../auth-helper');
const { db } = require('../firebase');

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
    const goal = Number(req.body?.goal ?? req.body?.weekGoal);
    if (!Number.isFinite(goal) || goal < 0 || goal > 10080) return res.status(400).json({
        message: 'Invalid goal'
    });
    try {
        await db.collection('users').doc(uid).update({
            practice_goal: Math.round(goal)
        });
    } catch (e) {
        console.error('setPracticeGoal error', e);
        return res.status(500).json({
            message: 'Internal Server Error'
        });
    }
    return res.status(200).json({
        message: 'Goal Saved',
        weekGoal: Math.round(goal)
    });
};