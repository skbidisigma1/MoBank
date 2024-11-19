const serverless = require('serverless-http');
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const lusca = require('lusca');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();


const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 125,
  handler: (req, res) => {
    res.status(429).json({ message: "Rate limit exceeded. Please wait a few minutes and try again." });
  },
});

const corsOptions = {
  origin: 'https://mo-bank.vercel.app',
  methods: ['GET', 'POST'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json());
app.use(cookieParser());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.auth0.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", `https://${process.env.AUTH0_DOMAIN}`],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
    },
  })
);

app.use(lusca.csrf());

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

app.post('/login', jwtCheck, async (req, res) => {
  const uid = req.user.sub;
  const email = req.user.email;
  const name = req.user.name || 'Unknown';
  const roles = req.user['https://mo-bank.vercel.app/roles'] || ['user'];
  await addUser(uid, email, { name, role: roles });
  res.sendStatus(200);
});

app.post('/updateProfile', jwtCheck, async (req, res) => {
  const uid = req.user.sub;
  const { class_period, instrument } = req.body;

  if (class_period == null || instrument == null) {
    return res.status(400).send('Missing class_period or instrument');
  }

  const publicDataRef = db.collection('users').doc(uid).collection('publicData').doc('main');
  await publicDataRef.set({ class_period, instrument }, { merge: true });

  res.sendStatus(200);
});

app.get('/getUserData', jwtCheck, async (req, res) => {
  const uid = req.user.sub;
  const userData = await getUserData(uid);
  if (userData) {
    res.json(userData);
  } else {
    res.status(404).send('User not found');
  }
});

app.post('/transactions', jwtCheck, async (req, res) => {
  const roles = req.user['https://mo-bank.vercel.app/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).send('Forbidden: Admins only');
  }
  const { senderId, receiverId, amount, transactionType } = req.body;
  const adminId = req.user.sub;
  await addTransaction(senderId, receiverId, amount, transactionType, adminId);
  res.sendStatus(200);
});

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('Invalid token');
  } else {
    next(err);
  }
});

app.post('/api/adminAdjustBalance', jwtCheck, async (req, res) => {
  const roles = req.user['https://mo-bank.vercel.app/roles'] || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }

  let body = '';
  await new Promise((resolve) => {
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', resolve);
  });

  const { name, period, amount } = JSON.parse(body);

  if (!name || !period || !amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const usersRef = db.collection('users');
    const query = usersRef.where('publicData.main.class_period', '==', parseInt(period, 10))
                          .where('publicData.main.name', '==', name);

    const snapshot = await query.get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userDoc = snapshot.docs[0];
    const userRef = userDoc.ref.collection('publicData').doc('main');

    await userRef.update({
      currency_balance: admin.firestore.FieldValue.increment(amount),
    });

    return res.status(200).json({ message: 'Balance adjusted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
  }
});

async function addUser(uid, email, metadata = {}) {
  const publicDataRef = db.collection('users').doc(uid).collection('publicData').doc('main');
  await publicDataRef.set({
    name: metadata.name || 'Unknown',
    instrument: metadata.instrument || '',
    class_period: metadata.class_period || null,
    currency_balance: metadata.currency_balance || 0,
    picture: '/images/default_profile.svg',
  }, { merge: true });

  const privateDataRef = db.collection('users').doc(uid).collection('privateData').doc('main');
  await privateDataRef.set({
    email: email,
    auth0_user_id: uid,
    role: metadata.role || ['user'],
  }, { merge: true });
}

async function addTransaction(senderId, receiverId, amount, transactionType, adminId = null) {
  const transactionRef = db.collection('transactions').doc();
  const transactionId = transactionRef.id;

  const transactionData = {
    senderId,
    receiverId,
    amount,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    transactionType,
    adminId,
    status: 'pending',
  };

  await transactionRef.set(transactionData);

  if (senderId) {
    const senderHistoryRef = db.collection('users').doc(senderId).collection('transaction_history').doc(transactionId);
    await senderHistoryRef.set(transactionData);
  }

  if (receiverId) {
    const receiverHistoryRef = db.collection('users').doc(receiverId).collection('transaction_history').doc(transactionId);
    await receiverHistoryRef.set(transactionData);
  }

  if (transactionType === 'send') {
    const senderRef = db.collection('users').doc(senderId).collection('publicData').doc('main');
    const receiverRef = db.collection('users').doc(receiverId).collection('publicData').doc('main');

    await senderRef.update({
      currency_balance: admin.firestore.FieldValue.increment(-amount),
    });
    await receiverRef.update({
      currency_balance: admin.firestore.FieldValue.increment(amount),
    });
  }
}

async function getUserData(uid) {
  const publicDataRef = db.collection('users').doc(uid).collection('publicData').doc('main');
  const privateDataRef = db.collection('users').doc(uid).collection('privateData').doc('main');

  const [publicDoc, privateDoc] = await Promise.all([publicDataRef.get(), privateDataRef.get()]);

  if (!publicDoc.exists || !privateDoc.exists) {
    return null;
  }

  return {
    publicData: publicDoc.data(),
    privateData: privateDoc.data(),
  };
}

module.exports = serverless(app);
