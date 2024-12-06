const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const express = require('express');
require('dotenv').config();

const { admin, db } = require('../firebase');

const app = express();

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

app.use(express.json());

app.get('/api/getLeaderboard', jwtCheck, async (req, res) => {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const leaderboardData = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      leaderboardData.push({
        uid: doc.id,
        name: data.name || 'Unknown User',
        balance: data.currency_balance || 0,
        instrument: data.instrument || 'N/A',
        class_period: data.class_period || 'N/A',
      });
    });

    leaderboardData.sort((a, b) => b.balance - a.balance);

    res.status(200).json(leaderboardData);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = app;
