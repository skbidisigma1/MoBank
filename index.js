const serverless = require('serverless-http');
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const path = require('path');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const lusca = require('lusca');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 125,
  handler: (req, res) => {
    res.status(429).json({
      message: "Rate limit exceeded. Please wait a few minutes and try again."
    });
  }
});

app.use(limiter);

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

app.use(express.json());
app.use(cookieParser());
app.use(lusca.csrf());

const jwtCheck = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
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

  const userRef = db.collection('users').doc(uid);
  await userRef.set(
    {
      class_period,
      instrument,
    },
    { merge: true }
  );

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

async function addUser(uid, email, metadata = {}) {
  const userRef = db.collection('users').doc(uid);
  await userRef.set(
    {
      auth0_user_id: uid,
      name: metadata.name || 'Unknown',
      email: email,
      currency_balance: metadata.currency_balance || 0,
      role: metadata.role || ['user'],
      transaction_history: metadata.transaction_history || [],
      class_period: metadata.class_period || null,
      instrument: metadata.instrument || '',
    },
    { merge: true }
  );
}

async function addTransaction(senderId, receiverId, amount, transactionType, adminId = null) {
  const transactionRef = db.collection('transactions').doc();
  await transactionRef.set({
    senderId,
    receiverId,
    amount,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    transactionType,
    adminId,
  });

  if (transactionType === 'add') {
    const receiverRef = db.collection('users').doc(receiverId);
    await receiverRef.update({
      currency_balance: admin.firestore.FieldValue.increment(amount),
    });
  } else if (transactionType === 'remove') {
    const receiverRef = db.collection('users').doc(receiverId);
    await receiverRef.update({
      currency_balance: admin.firestore.FieldValue.increment(-amount),
    });
  } else if (transactionType === 'send') {
    const senderRef = db.collection('users').doc(senderId);
    const receiverRef = db.collection('users').doc(receiverId);
    await senderRef.update({
      currency_balance: admin.firestore.FieldValue.increment(-amount),
    });
    await receiverRef.update({
      currency_balance: admin.firestore.FieldValue.increment(amount),
    });
  }
}

async function getUserData(uid) {
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();
  return userDoc.exists ? userDoc.data() : null;
}

module.exports = serverless(app);