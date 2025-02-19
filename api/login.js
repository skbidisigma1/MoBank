const fetch = require('node-fetch')
const { db } = require('../firebase')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const userInfoResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!userInfoResponse.ok) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const userInfo = await userInfoResponse.json()

    const uid = userInfo.sub
    const name = userInfo.name || 'Unknown'

    const userRef = db.collection('users').doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      await userRef.set({
        name: name,
        instrument: '',
        class_period: null,
        currency_balance: 0,
        theme: '',
      })
    }

    return res.status(200).json({ message: 'User initialized successfully' })
  } catch (error) {
    console.error('Internal Server Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}