const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Token verification failed' });
  }
  const uid = decoded.sub;

  let bodyData = {};
  if (req.body && Object.keys(req.body).length) {
    bodyData = req.body;
  } else {
    let raw = '';
    await new Promise((resolve, reject) => {
      req.on('data', chunk => (raw += chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    try {
      bodyData = JSON.parse(raw || '{}');
    } catch {
      return res.status(400).json({ message: 'Invalid JSON format' });
    }
  }

  const { class_period, instrument, theme } = bodyData;

  const cp = parseInt(class_period, 10);
  const validClassPeriods = [5, 6, 7, 8, 9, 10];
  const validInstruments = ['violin', 'viola', 'cello', 'bass', 'other'];
  const validThemes = ['light', 'dark'];

  if (!validClassPeriods.includes(cp)) {
    return res.status(400).json({ message: 'Invalid class period' });
  }
  if (
    typeof instrument !== 'string' ||
    !validInstruments.includes(instrument.toLowerCase())
  ) {
    return res.status(400).json({ message: 'Invalid instrument' });
  }
  if (
    typeof theme !== 'string' ||
    !validThemes.includes(theme.toLowerCase())
  ) {
    return res.status(400).json({ message: 'Invalid theme' });
  }

  try {
    await db.collection('users').doc(uid).set(
      {
        class_period: cp,
        instrument: instrument.toLowerCase(),
        theme: theme.toLowerCase(),
      },
      { merge: true }
    );
    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};