
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
    return res.status(401).json({ message: 'Token verification failed', error: err.toString() })
  }

  const uid = decoded.sub

  try {
    const userRef = db.collection('users').doc(uid)
    const userDoc = await userRef.get()

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' })
    }

    const publicData = userDoc.data()
    return res.status(200).json(publicData)
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}