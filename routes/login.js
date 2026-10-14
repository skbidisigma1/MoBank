const { db } = require('../firebase')
const { createSessionToken, createSessionCookie, setCookieHeader } = require('../session')

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

    // Issue wildcard cross-subdomain session cookie for *.mo-classroom.us
    try {
      const email = userInfo.email || '';
      if (email) {
        const sessionToken = await createSessionToken({ email, sub: uid });
        const host = req.headers.host || '';
        const isSecure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.secure);
        const cookieHeader = createSessionCookie(sessionToken, { host, isSecure });
        setCookieHeader(res, cookieHeader);
      } else {
        console.warn('Auth0 userinfo did not contain email; skipping mo_session cookie');
      }
    } catch (sessionErr) {
      console.error('Failed to issue cross-subdomain session cookie:', sessionErr);
    }
    
    const totalTime = profiler.end('login-total');
    
    return res.status(200).json({ message: 'User initialized successfully' })
  } catch (error) {
    console.error('Internal Server Error:', error)
    profiler.end('login-total');
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}