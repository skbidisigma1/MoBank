const admin = require('firebase-admin');
const express = require('express');
const app = express();

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

module.exports = app;
