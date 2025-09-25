const { db } = require('../firebase')

const profiler = {
  startTime: {},
  start: (label) => {
    profiler.startTime[label] = process.hrtime();
  },
  end: (label) => {
    const diff = process.hrtime(profiler.startTime[label]);
    const ms = (diff[0] * 1e9 + diff[1]) / 1e6;
    return ms;
  }
};

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.substring(7) : null;
};

module.exports = async (req, res) => {
  profiler.start('login-total');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    profiler.start('auth0-api-call');
    const userInfoResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    profiler.end('auth0-api-call');    if (!userInfoResponse.ok) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    profiler.start('json-parsing');
    const userInfo = await userInfoResponse.json()
    profiler.end('json-parsing');

    const uid = userInfo.sub
    const name = userInfo.name || 'Unknown'

    profiler.start('firestore-get');
    const userRef = db.collection('users').doc(uid)
    const userDoc = await userRef.get()
    profiler.end('firestore-get');    if (!userDoc.exists) {
      profiler.start('firestore-create');
      await userRef.set({
        name: name,
        instrument: '',
        class_period: null,
        currency_balance: 0,
        theme: '',
      })
      profiler.end('firestore-create');
    }
    
    const totalTime = profiler.end('login-total');
    
    return res.status(200).json({ message: 'User initialized successfully' })
  } catch (error) {
    console.error('Internal Server Error:', error)
    profiler.end('login-total');
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}