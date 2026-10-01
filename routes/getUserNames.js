const { db } = require('../firebase')
const { getTokenFromHeader, verifyToken } = require('../auth-helper')
const VALID_PERIODS = new Set(require('../js/class-periods').map(({ value }) => value))

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const token = getTokenFromHeader(req)
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  let decoded
  try {
    decoded = await verifyToken(token)
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed' })
  }

  const roles = decoded?.['https://mo-classroom.us/roles'] || []
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden: Admins only' })
  }

  const rawPeriod = req.query.period
  const period = typeof rawPeriod === 'string' ? Number(rawPeriod) : NaN
  if (!Number.isInteger(period) || !VALID_PERIODS.has(period)) {
    return res.status(400).json({ message: 'Invalid period' })
  }

  try {
    const snapshot = await db
      .collection('users')
      .where('class_period', '==', period)
      .get()

    // Keep the admin page's existing response contract: a plain array of names.
    // This endpoint no longer refreshes leaderboard aggregates as a side effect;
    // leaderboard reads now use the current user documents directly.
    const names = snapshot.docs.map(doc => {
      const data = doc.data()
      return typeof data.name === 'string' && data.name.trim()
        ? data.name.trim()
        : 'Unknown User'
    })

    return res.status(200).json(names)
  } catch (error) {
    console.error('getUserNames error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
