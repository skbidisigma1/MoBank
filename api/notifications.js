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
      algorithms: ['RS256']
    },
    async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Token verification failed' })
      }

      const userId = decoded.sub

      let body = ''
      await new Promise((resolve) => {
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', resolve)
      })

      const { action } = JSON.parse(body)

      try {
        const userRef = db.collection('users').doc(userId)
        const userDoc = await userRef.get()

        if (!userDoc.exists) {
          return res.status(404).json({ message: 'User not found' })
        }

        if (action === 'markAsRead') {
          const notifications = userDoc.data().notifications || []

          const updatedNotifications = notifications.map(notification => ({
            ...notification,
            read: true
          }))

          await userRef.update({ notifications: updatedNotifications })
          return res.status(200).json({ message: 'All notifications marked as read' })
        } 
        else if (action === 'clearAll') {
          await userRef.update({ notifications: [] })
          return res.status(200).json({ message: 'All notifications cleared' })
        } 
        else {
          return res.status(400).json({ message: 'Invalid action' })
        }
      } catch (error) {
        console.error('Error processing notification action:', error)
        return res.status(500).json({ message: 'Internal Server Error' })
      }
    }
  )
}
