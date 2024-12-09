const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const { admin, db } = require('../firebase')

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
        return res.status(401).json({ message: 'Token verification failed', error: err.toString() })
      }

      const roles = decoded['https://mo-classroom.us/roles'] || []
      if (!roles.includes('admin')) {
        return res.status(403).json({ message: 'Forbidden: Admins only' })
      }

      let body = ''
      await new Promise((resolve) => {
        req.on('data', (chunk) => { body += chunk })
        req.on('end', resolve)
      })

      const { name, period, amount } = JSON.parse(body)

      if (!name || !period || typeof amount !== 'number') {
        return res.status(400).json({ message: 'Invalid input' })
      }

      try {
        const usersRef = db.collection('users')
        const query = usersRef
          .where('class_period', '==', parseInt(period, 10))
          .where('name', '==', name)

        const snapshot = await query.get()

        if (snapshot.empty) {
          return res.status(404).json({ message: 'User not found' })
        }

        const userDoc = snapshot.docs[0]
        const userRef = userDoc.ref

        await db.runTransaction(async (transaction) => {
          const userSnapshot = await transaction.get(userRef)
          if (!userSnapshot.exists) {
            throw new Error('User does not exist')
          }

          const updatedBalance = (userSnapshot.data().currency_balance || 0) + amount

          transaction.update(userRef, {
            currency_balance: updatedBalance
          })

          const transactionEntry = {
            type: amount >= 0 ? 'credit' : 'debit',
            amount: Math.abs(amount),
            counterpart: 'Admin',
            timestamp: admin.firestore.Timestamp.now()
          }

          const existingTransactions = userSnapshot.data().transactions || []
          existingTransactions.unshift(transactionEntry)
          if (existingTransactions.length > 5) {
            existingTransactions.splice(5)
          }
          transaction.update(userRef, { transactions: existingTransactions })
        })

        return res.status(200).json({ message: 'Balance adjusted successfully' })
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.toString() })
      }
    }
  )
}
