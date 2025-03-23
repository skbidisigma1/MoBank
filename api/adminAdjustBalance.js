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

      const { name, period, amount, instrument } = JSON.parse(body)

      if (!period || typeof amount !== 'number') {
        return res.status(400).json({ message: 'Invalid input' })
      }

      try {
        if (name) {
          // Individual student update
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

            const formattedAmount = Math.abs(amount)
            const moBucksText = formattedAmount === 1 ? 'MoBuck' : 'MoBucks'

            const notification = {
              message: amount >= 0
                ? `You received ${formattedAmount} ${moBucksText} from Admin`
                : `You were charged ${formattedAmount} ${moBucksText} by Admin`,
              type: 'admin_transfer',
              timestamp: admin.firestore.Timestamp.now(),
              read: false
            }

            const userNotifications = userSnapshot.data().notifications || []
            userNotifications.push(notification)

            userNotifications.sort((a, b) =>
              b.timestamp.seconds - a.timestamp.seconds ||
              b.timestamp.nanoseconds - a.timestamp.nanoseconds
            )

            if (userNotifications.length > 10) {
              userNotifications.splice(10)
            }

            transaction.update(userRef, {
              currency_balance: updatedBalance,
              transactions: existingTransactions,
              notifications: userNotifications
            })
          })

          // Update leaderboard
          const usersRef2 = db.collection('users').where('class_period', '==', parseInt(period, 10))
          const snapshot2 = await usersRef2.get()
          const userData = snapshot2.docs
            .map((doc) => {
              const data = doc.data()
              return {
                uid: doc.id,
                name: data.name || 'Unknown User',
                balance: data.currency_balance || 0,
                instrument: data.instrument || 'N/A'
              }
            })
            .filter((u) => u.name)

          const leaderboardData = userData.sort((a, b) => b.balance - a.balance)
          const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`)
          await aggregateRef.set(
            {
              leaderboardData: leaderboardData,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          )

          return res.status(200).json({ message: 'Balance adjusted successfully' })
        } else if (instrument) {
          // Instrument-based update
          const usersRef = db.collection('users')
            .where('class_period', '==', parseInt(period, 10))
            .where('instrument', '==', instrument)

          const snapshot = await usersRef.get()

          if (snapshot.empty) {
            return res.status(404).json({ message: `No ${instrument} players found in period ${period}` })
          }

          const formattedAmount = Math.abs(amount)
          const moBucksText = formattedAmount === 1 ? 'MoBuck' : 'MoBucks'
          const now = admin.firestore.Timestamp.now()

          const transactionEntry = {
            type: amount >= 0 ? 'credit' : 'debit',
            amount: Math.abs(amount),
            counterpart: 'Admin',
            timestamp: now
          }

          const notification = {
            message: amount >= 0
              ? `You received ${formattedAmount} ${moBucksText} from Admin (${instrument} section)`
              : `You were charged ${formattedAmount} ${moBucksText} by Admin (${instrument} section)`,
            type: 'admin_transfer',
            timestamp: now,
            read: false
          }

          // Need to use separate transactions for each user
          const promises = snapshot.docs.map(async (doc) => {
            const userRef = doc.ref

            return db.runTransaction(async (transaction) => {
              const docSnapshot = await transaction.get(userRef)

              // Handle transactions
              const currentTransactions = docSnapshot.data().transactions || []
              const newTransactions = [transactionEntry, ...currentTransactions]
              if (newTransactions.length > 5) {
                newTransactions.splice(5)
              }

              // Handle notifications
              const userNotifications = docSnapshot.data().notifications || []
              userNotifications.push(notification)

              userNotifications.sort((a, b) =>
                b.timestamp.seconds - a.timestamp.seconds ||
                b.timestamp.nanoseconds - a.timestamp.nanoseconds
              )

              if (userNotifications.length > 10) {
                userNotifications.splice(10)
              }

              transaction.update(userRef, {
                currency_balance: admin.firestore.FieldValue.increment(amount),
                transactions: newTransactions,
                notifications: userNotifications
              })
            })
          })

          await Promise.all(promises)

          // Update leaderboard
          const snapshot2 = await usersRef.get()
          const userData = snapshot2.docs
            .map((d) => {
              const dt = d.data()
              return {
                uid: d.id,
                name: dt.name || 'Unknown User',
                balance: dt.currency_balance || 0,
                instrument: dt.instrument || 'N/A'
              }
            })
            .filter((u) => u.name)

          const leaderboardData = userData.sort((a, b) => b.balance - a.balance)
          const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`)
          await aggregateRef.set(
            {
              leaderboardData: leaderboardData,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          )

          return res.status(200).json({ message: 'Balances updated successfully' })
        } else {
          // Class-wide update
          const usersRef = db.collection('users').where('class_period', '==', parseInt(period, 10))
          const snapshot = await usersRef.get()

          if (snapshot.empty) {
            return res.status(404).json({ message: 'No users found for this period' })
          }

          const formattedAmount = Math.abs(amount)
          const moBucksText = formattedAmount === 1 ? 'MoBuck' : 'MoBucks'
          const now = admin.firestore.Timestamp.now()

          const transactionEntry = {
            type: amount >= 0 ? 'credit' : 'debit',
            amount: Math.abs(amount),
            counterpart: 'Admin',
            timestamp: now
          }

          const notification = {
            message: amount >= 0
              ? `You received ${formattedAmount} ${moBucksText} from Admin (class-wide)`
              : `You were charged ${formattedAmount} ${moBucksText} by Admin (class-wide)`,
            type: 'admin_transfer',
            timestamp: now,
            read: false
          }

          // Need to use separate transactions for each user
          const promises = snapshot.docs.map(async (doc) => {
            const userRef = doc.ref

            return db.runTransaction(async (transaction) => {
              const docSnapshot = await transaction.get(userRef)

              // Handle transactions
              const currentTransactions = docSnapshot.data().transactions || []
              const newTransactions = [transactionEntry, ...currentTransactions]
              if (newTransactions.length > 5) {
                newTransactions.splice(5)
              }

              // Handle notifications
              const userNotifications = docSnapshot.data().notifications || []
              userNotifications.push(notification)

              userNotifications.sort((a, b) =>
                b.timestamp.seconds - a.timestamp.seconds ||
                b.timestamp.nanoseconds - a.timestamp.nanoseconds
              )

              if (userNotifications.length > 10) {
                userNotifications.splice(10)
              }

              transaction.update(userRef, {
                currency_balance: admin.firestore.FieldValue.increment(amount),
                transactions: newTransactions,
                notifications: userNotifications
              })
            })
          })

          await Promise.all(promises)

          // Update leaderboard
          const snapshot2 = await usersRef.get()
          const userData = snapshot2.docs
            .map((d) => {
              const dt = d.data()
              return {
                uid: d.id,
                name: dt.name || 'Unknown User',
                balance: dt.currency_balance || 0,
                instrument: dt.instrument || 'N/A'
              }
            })
            .filter((u) => u.name)

          const leaderboardData = userData.sort((a, b) => b.balance - a.balance)
          const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`)
          await aggregateRef.set(
            {
              leaderboardData: leaderboardData,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          )

          return res.status(200).json({ message: 'Balances updated successfully' })
        }
      } catch (error) {
        return res.status(500).json({ message: 'Internal Server Error', error: error.toString() })
      }
    }
  )
}