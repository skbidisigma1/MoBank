const { getTokenFromHeader, verifyToken } = require('../auth-helper');
const { db, admin } = require('../firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  const token = getTokenFromHeader(req); if (!token) return res.status(401).json({ message: 'Unauthorized' });
  let decoded; try { decoded = await verifyToken(token); } catch { return res.status(401).json({ message: 'Token verification failed' }); }
  const uid = decoded.sub;
  try {
    await db.collection('users').doc(uid).update({ practice_active_session: admin.firestore.FieldValue.delete() });
  } catch (e) {
    // Ignore missing field
    if (process.env.NODE_ENV !== 'production') console.warn('cancelPracticeSession warn', e.message);
  }
  return res.status(200).json({ message: 'Cancelled' });
};
