const { db } = require('../firebase');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

async function getBody(req) {
  if (req.body && Object.keys(req.body).length) return req.body;
  let raw = '';
  await new Promise((res, rej) => {
    req.on('data', chunk => (raw += chunk));
    req.on('end', res);
    req.on('error', rej);
  });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('INVALID_JSON');
  }
}

module.exports = async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (e) {
    return res.status(401).json({ message: 'Token verification failed' });
  }
  const uid = decoded.sub;

  if (req.method === 'GET') {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (!doc.exists) return res.status(404).json({ message: 'User not found' });
      const presets = Array.isArray(doc.data().metronomePresets) ? doc.data().metronomePresets : [];
      return res.status(200).json(presets);
    } catch (e) {
      console.error('GET metronomePresets error:', e);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  let body;
  try {
    body = await getBody(req);
  } catch (e) {
    if (e.message === 'INVALID_JSON') return res.status(400).json({ message: 'Invalid JSON format' });
    console.error('Body parse error:', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }

  if (req.method === 'POST') {
    const { name, description = '', settings } = body;
    if (!name || typeof name !== 'string' || typeof settings !== 'object')
      return res.status(400).json({ message: 'Invalid input' });

    const id = `preset_${Date.now()}`;
    try {
      await db.runTransaction(async t => {
        const ref = db.collection('users').doc(uid);
        const snap = await t.get(ref);
        const presets = snap.exists && Array.isArray(snap.data().metronomePresets) ? snap.data().metronomePresets : [];
        if (presets.length >= 8) throw new Error('LIMIT');
        const now = Date.now();
        t.set(
          ref,
          { metronomePresets: [...presets, { id, name, description, createdAt: now, updatedAt: now, settings }] },
          { merge: true }
        );
      });
      const { metronomePresets } = (await db.collection('users').doc(uid).get()).data();
      return res.status(201).json(metronomePresets.find(p => p.id === id));
    } catch (e) {
      console.error('POST metronomePresets error:', e);
      if (e.message === 'LIMIT') return res.status(400).json({ message: 'Preset limit reached' });
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'PUT') {
    const { presetId, name, description = '', settings } = body;
    if (!presetId || !name || typeof name !== 'string' || typeof settings !== 'object')
      return res.status(400).json({ message: 'Invalid input' });

    try {
      await db.runTransaction(async t => {
        const ref = db.collection('users').doc(uid);
        const snap = await t.get(ref);
        const presets = snap.exists && Array.isArray(snap.data().metronomePresets) ? snap.data().metronomePresets : [];
        const idx = presets.findIndex(p => p.id === presetId);
        if (idx === -1) throw new Error('NOT_FOUND');
        presets[idx] = { ...presets[idx], name, description, settings, updatedAt: Date.now() };
        t.update(ref, { metronomePresets: presets });
      });
      const { metronomePresets } = (await db.collection('users').doc(uid).get()).data();
      return res.status(200).json(metronomePresets.find(p => p.id === body.presetId));
    } catch (e) {
      console.error('PUT metronomePresets error:', e);
      if (e.message === 'NOT_FOUND') return res.status(404).json({ message: 'Preset not found' });
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    const { presetId } = body;
    if (!presetId) return res.status(400).json({ message: 'Invalid input' });

    try {
      await db.runTransaction(async t => {
        const ref = db.collection('users').doc(uid);
        const snap = await t.get(ref);
        const presets = snap.exists && Array.isArray(snap.data().metronomePresets) ? snap.data().metronomePresets : [];
        const newPresets = presets.filter(p => p.id !== presetId);
        if (newPresets.length === presets.length) throw new Error('NOT_FOUND');
        t.update(ref, { metronomePresets: newPresets });
      });
      return res.status(204).end();
    } catch (e) {
      console.error('DELETE metronomePresets error:', e);
      if (e.message === 'NOT_FOUND') return res.status(404).json({ message: 'Preset not found' });
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};