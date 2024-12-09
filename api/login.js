const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const { admin, db } = require('../firebase')

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
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
  if (req.method !== 'POST') {
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
      algorithms: ['RS256'],
    },
    async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Token verification failed', error: err.toString() })
      }

      const uid = decoded.sub

      try {
        const userRef = db.collection('users').doc(uid)
        const userDoc = await userRef.get()

        if (!userDoc.exists) {
          await userRef.set({
            name: decoded.name || 'Unknown',
            instrument: '',
            class_period: null,
            currency_balance: 0,
          })
        }

        const privateDataRef = userRef.collection('privateData').doc('main')
        const privateDoc = await privateDataRef.get()

        return res.status(200).json({ message: 'User initialized successfully' })
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.toString() })
      }
    }
  )
}
