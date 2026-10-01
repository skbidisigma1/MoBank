  const { admin, db } = require('../firebase')
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

  try {
    await verifyToken(token)
  } catch (err) {
    return res.status(401).json({ message: 'Token verification failed' })
  }

  const rawPeriod = req.query.period
  const period = typeof rawPeriod === 'string' ? Number(rawPeriod) : NaN
  if (!Number.isInteger(period) || !VALID_PERIODS.has(period)) {
    return res.status(400).json({ message: 'Invalid period' })
  }

  try {
    // Read user documents directly so transfers, purchases, refunds, and school-year
    // changes are reflected immediately instead of relying on stale aggregate docs.
    const leaderboardData = await db.runTransaction(async tx => {
      const resetLock = await tx.get(db.collection('maintenance').doc('classPeriodReset'))
      if (resetLock.exists && resetLock.get('status') === 'running') {
        const error = new Error('School-year setup is in progress. Please try again shortly.')
        error.code = 'SCHOOL_YEAR_SETUP_IN_PROGRESS'
        throw error
      }

      const snapshot = await tx.get(
        db.collection('users').where('class_period', '==', period)
      )
      return snapshot.docs
        .map(doc => {
          const data = doc.data()
          const balance = Number(data.currency_balance ?? 0)

          return {
            name: typeof data.name === 'string' && data.name.trim()
              ? data.name.trim()
              : 'Unknown User',
            balance: Number.isFinite(balance) ? balance : 0,
            instrument: typeof data.instrument === 'string' && data.instrument.trim()
              ? data.instrument.trim()
              : 'N/A',
          }
        })
        .sort((a, b) => b.balance - a.balance)
    })

    return res.status(200).json({
      lastUpdated: admin.firestore.Timestamp.now(),
      leaderboardData,
    })
  } catch (error) {
    if (error.code === 'SCHOOL_YEAR_SETUP_IN_PROGRESS') {
      return res.status(503).json({ message: error.message })
    }
    console.error('getAggregatedLeaderboard error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
