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
          return res.status(401).json({ message: 'Token verification failed' })
        }

        const senderUid = decoded.sub

        let body = ''
        await new Promise((resolve) => {
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', resolve)
        })

        const { recipientName, amount } = JSON.parse(body)

        if (!recipientName || !amount || amount <= 0) {
          return res.status(400).json({ message: 'Invalid input' })
        }

        try {
          const senderRef = db.collection('users').doc(senderUid)
          const recipientQuery = db
              .collection('users')
              .where('name', '==', recipientName)

          const [senderDoc, recipientSnapshot] = await Promise.all([
            senderRef.get(),
            recipientQuery.get(),
          ])

          if (!senderDoc.exists) {
            return res.status(404).json({ message: 'Sender not found' })
          }

          if (recipientSnapshot.empty) {
            return res.status(404).json({ message: 'Recipient not found' })
          }

          const recipientDoc = recipientSnapshot.docs[0]
          const recipientUid = recipientDoc.id
          const recipientRef = recipientDoc.ref

          if (senderUid === recipientUid) {
            return res
                .status(400)
                .json({ message: 'Self-transfers are not allowed.' })
          }

          const senderData = senderDoc.data()
          const senderBalance = senderData.currency_balance || 0

          if (senderBalance < amount) {
            return res.status(400).json({ message: 'Insufficient balance' })
          }

          await db.runTransaction(async (transaction) => {
            const senderSnapshot = await transaction.get(senderRef)
            const recipientSnapshot = await transaction.get(recipientRef)

            if (!senderSnapshot.exists) {
              throw new Error('Sender does not exist')
            }
            if (!recipientSnapshot.exists) {
              throw new Error('Recipient does not exist')
            }

            const updatedSenderBalance =
                (senderSnapshot.data().currency_balance || 0) - amount
            const updatedRecipientBalance =
                (recipientSnapshot.data().currency_balance || 0) + amount

            if (updatedSenderBalance < 0) {
              throw new Error('Insufficient balance')
            }

            transaction.update(senderRef, {
              currency_balance: updatedSenderBalance,
            })
            transaction.update(recipientRef, {
              currency_balance: updatedRecipientBalance,
            })

            const formattedAmount = Math.abs(amount)
            const moBucksText = formattedAmount === 1 ? 'MoBuck' : 'MoBucks'

            const senderTransactions = senderSnapshot.data().transactions || []
            senderTransactions.unshift({
              type: 'debit',
              amount: amount,
              counterpart: recipientName,
              timestamp: admin.firestore.Timestamp.now(),
            })
            if (senderTransactions.length > 5) {
              senderTransactions.splice(5)
            }
            transaction.update(senderRef, { transactions: senderTransactions })

            const recipientTransactions = recipientSnapshot.data().transactions || []
            recipientTransactions.unshift({
              type: 'credit',
              amount: amount,
              counterpart: senderData.name || 'Unknown',
              timestamp: admin.firestore.Timestamp.now(),
            })
            if (recipientTransactions.length > 5) {
              recipientTransactions.splice(5)
            }
            transaction.update(recipientRef, { transactions: recipientTransactions })

            const recipientNotification = {
              message: `You received ${formattedAmount} ${moBucksText} from ${
                  senderData.name ?? 'Unknown Sender'
              }`,
              type: 'transfer_received',
              timestamp: admin.firestore.Timestamp.now(),
              read: false,
            }

            transaction.update(recipientRef, {
              notifications: admin.firestore.FieldValue.arrayUnion(recipientNotification),
            })
          })

          return res.status(200).json({ message: 'Transfer successful' })
        } catch (error) {
          console.error('Transfer Error:', error)
          if (error.message === 'Insufficient balance') {
            return res.status(400).json({ message: 'Insufficient balance' })
          }
          return res.status(500).json({ message: 'Internal Server Error' })
        }
      }
  )
}