const { db } = require('../firebase')
const { getTokenFromHeader, verifyToken } = require('../auth-helper')

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

  const period = parseInt(req.query.period, 10)
  const validPeriods = [4, 5, 6, 7, 8, 10]
  if (!period || !validPeriods.includes(period)) {
    return res.status(400).json({ message: 'Invalid period' })
  }

  try {
    const docRef = db.collection('aggregates').doc(`leaderboard_period_${period}`)
    const doc = await docRef.get()
    if (!doc.exists) {
      return res.status(404).json({ message: 'No users in this period' })
    }
    const data = doc.data()
    const cleanedLeaderboardData = data.leaderboardData.map(({ uid, ...rest }) => rest)
    return res.status(200).json({
      lastUpdated: data.lastUpdated,
      leaderboardData: cleanedLeaderboardData
    })
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}
