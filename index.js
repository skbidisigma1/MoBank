const serverless = require('serverless-http');
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 125,
  keyGenerator: (req) => req.auth?.payload?.sub || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  },
});

const corsOptions = {
  origin: 'https://mo-classroom.us',
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.auth0.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'", `https://${process.env.AUTH0_DOMAIN}`],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  })
);

const { admin, db } = require('./firebase');

const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 30,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

app.use('/api', jwtCheck, userRateLimiter);

async function addUser(uid, email, metadata = {}) {
  const userRef = db.collection('users').doc(uid);
  await userRef.set(
    {
      name: metadata.name || 'Unknown',
      instrument: metadata.instrument || '',
      class_period: metadata.class_period || null,
      currency_balance: metadata.currency_balance || 0,
    },
    { merge: true }
  );

  const privateDataRef = userRef.collection('privateData').doc('main');
  await privateDataRef.set(
    {
      email: email,
      auth0_user_id: uid,
      role: metadata.role || ['user'],
    },
    { merge: true }
  );
}

async function getUserData(uid) {
  const userRef = db.collection('users').doc(uid);
  const privateDataRef = userRef.collection('privateData').doc('main');

  const [userDoc, privateDoc] = await Promise.all([userRef.get(), privateDataRef.get()]);

  if (!userDoc.exists || !privateDoc.exists) {
    return null;
  }

  return {
    ...userDoc.data(),
    privateData: privateDoc.data(),
  };
}

app.post('/api/login', async (req, res) => {
  try {
    const uid = req.auth.payload.sub;
    const email = req.auth.payload.email;
    const name = req.auth.payload.name || 'Unknown';
    const roles = req.auth.payload['https://mo-classroom.us/roles'] || ['user'];
    await addUser(uid, email, { name, role: roles });
    res.sendStatus(200);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/updateProfile', async (req, res) => {
  try {
    const uid = req.auth.payload.sub;
    const { class_period, instrument } = req.body;

    if (class_period == null || instrument == null) {
      return res.status(400).send('Missing class_period or instrument');
    }

    const userRef = db.collection('users').doc(uid);
    await userRef.set({ class_period, instrument }, { merge: true });

    res.sendStatus(200);
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/getUserData', async (req, res) => {
  try {
    const uid = req.auth.payload.sub;
    const userData = await getUserData(uid);
    if (userData && userData.class_period && userData.instrument) {
      res.json(userData);
    } else {
      res.status(404).send('Incomplete user data');
    }
  } catch (error) {
    console.error('Get User Data Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/adminAdjustBalance', async (req, res) => {
  try {
    const roles = req.auth.payload['https://mo-classroom.us/roles'] || [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const { name, period, amount } = req.body;

    if (!name || !period || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const usersRef = db.collection('users');
    const query = usersRef.where('class_period', '==', parseInt(period, 10)).where('name', '==', name);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userDoc = snapshot.docs[0];
    const userRef = userDoc.ref;

    await userRef.update({
      currency_balance: admin.firestore.FieldValue.increment(amount),
    });

    res.status(200).json({ message: 'Balance adjusted successfully' });
  } catch (error) {
    console.error('Admin Adjust Balance Error:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
});

app.post('/api/aggregateLeaderboard', async (req, res) => {
  try {
    const roles = req.auth.payload['https://mo-classroom.us/roles'] || [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const { period } = req.body;

    if (!period || ![5, 6, 7].includes(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }

    const usersRef = db.collection('users').where('class_period', '==', parseInt(period, 10));
    const snapshot = await usersRef.get();

    const userData = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name || 'Unknown User',
          balance: data.currency_balance || 0,
          instrument: data.instrument || 'N/A',
        };
      })
      .filter((user) => user.name);

    const leaderboardData = userData.sort((a, b) => b.balance - a.balance);

    const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`);
    await aggregateRef.set(
      {
        leaderboardData: leaderboardData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ message: 'Leaderboard aggregated successfully' });
  } catch (error) {
    console.error('Aggregate Leaderboard Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/getAggregatedLeaderboard', async (req, res) => {
  try {
    const period = parseInt(req.query.period, 10);
    if (![5, 6, 7].includes(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }

    const docRef = db.collection('aggregates').doc(`leaderboard_period_${period}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Leaderboard data not found' });
    }

    const data = doc.data();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching aggregated leaderboard:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/getUserNames', async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return res.status(401).json({ message: 'Token verification failed' });
    }

    const user = await response.json();

    const period = parseInt(req.query.period, 10);

    if (!period || ![5, 6, 7].includes(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }

    const usersRef = db.collection('users').where('class_period', '==', period);
    const snapshot = await usersRef.get();

    const userData = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name || 'Unknown User',
          balance: data.currency_balance || 0,
          instrument: data.instrument || 'N/A',
        };
      })
      .filter((user) => user.name);

    const leaderboardData = userData.sort((a, b) => b.balance - a.balance);

    const aggregateRef = db.collection('aggregates').doc(`leaderboard_period_${period}`);
    await aggregateRef.set(
      {
        leaderboardData: leaderboardData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const names = userData.map((user) => user.name);

    res.status(200).json(names);
  } catch (error) {
    console.error('Get User Names Error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
});

app.use(express.static(path.join(__dirname, 'pages')));

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    if (req.path.startsWith('/api')) {
      res.status(401).json({ message: 'Unauthorized' });
    } else {
      next();
    }
  } else {
    next(err);
  }
});

module.exports = serverless(app);
