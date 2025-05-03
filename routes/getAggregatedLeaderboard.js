const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const { db } = require('../firebase')

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err)
    } else {
      const signingKey = key.getPublicKey()
      callback(null, signingKey)
    }
  })
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  jwt.verify(
    token,
    getKey,
    {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    },
    async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Token verification failed', error: err.toString() })
      }      const period = parseInt(req.query.period, 10)
      const validPeriods = [5, 6, 7, 8, 9, 10]

      if (!period || !validPeriods.includes(period)) {
        return res.status(400).json({ message: 'Invalid period' })
      }

      try {
        const docRef = db.collection('aggregates').doc(`leaderboard_period_${period}`)
        const doc = await docRef.get()

        if (!doc.exists) {
          return res.status(404).json({ message: 'User names not found' })
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
  )
}
