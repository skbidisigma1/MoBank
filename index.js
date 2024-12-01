const serverless = require('serverless-http');
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const admin = require('firebase-admin');
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
    res.status(429).json({ message: "Too many requests, please try again later." });
  },
});

const corsOptions = {
  origin: 'https://mo-bank.vercel.app',
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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
  });
}

const db = admin.firestore();

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

// Login Endpoint
app.post('/api/login', async (req, res) => {
  try {
    const uid = req.auth.payload.sub;
    const email = req.auth.payload.email;
    const name = req.auth.payload.name || 'Unknown';
    const roles = req.auth.payload['https://mo-bank.vercel.app/roles'] || ['user'];
    await addUser(uid, email, { name, role: roles });
    res.sendStatus(200);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update Profile Endpoint
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

// Get User Data Endpoint
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

// Admin Adjust Balance Endpoint
app.post('/api/adminAdjustBalance', async (req, res) => {
  try {
    const roles = req.auth.payload['https://mo-bank.vercel.app/roles'] || [];
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

// Aggregate Leaderboard Endpoint
app.post('/api/aggregateLeaderboard', async (req, res) => {
  try {
    const roles = req.auth.payload['https://mo-bank.vercel.app/roles'] || [];
    if (!roles.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const leaderboardData = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const period = data.class_period || 'Unknown';
      if (!leaderboardData[period]) {
        leaderboardData[period] = [];
      }
      leaderboardData[period].push({
        uid: doc.id,
        name: data.name || 'Unknown User',
        balance: data.currency_balance || 0,
        instrument: data.instrument || 'N/A',
      });
    });

    Object.keys(leaderboardData).forEach((period) => {
      leaderboardData[period].sort((a, b) => b.balance - a.balance);
    });

    const aggregateRef = db.collection('aggregates').doc('leaderboard');
    await aggregateRef.set({
      leaderboardData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: 'Leaderboard aggregated successfully' });
  } catch (error) {
    console.error('Aggregate Leaderboard Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Get Aggregated Leaderboard Endpoint
app.get('/api/getAggregatedLeaderboard', async (req, res) => {
  try {
    const docRef = db.collection('aggregates').doc('leaderboard');
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

// Get User Names Endpoint
app.get('/api/getUserNames', async (req, res) => {
  try {
    const period = parseInt(req.query.period, 10);
    if (!period) {
      return res.status(400).json({ message: 'Invalid period' });
    }

    const usersRef = db.collection('users').where('class_period', '==', period);
    const snapshot = await usersRef.get();

    const names = snapshot.docs
      .map((doc) => doc.data().name)
      .filter((name) => name);

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

module.exports = serverless(app);
