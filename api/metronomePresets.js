const { admin, db } = require('../firebase');

module.exports = async (req, res) => {
  console.log('metronomePresets.js invoked', { method: req.method, headers: req.headers });
  const uid = req.auth && req.auth.payload && req.auth.payload.sub;
  console.log('Auth check', { uid, auth: req.auth });
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return res.status(404).json({ message: 'User not found' });
      const data = userDoc.data();
      res.status(200).json(Array.isArray(data.metronomePresets) ? data.metronomePresets : []);
    } catch (error) {
      res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
    return;
  }

  if (req.method === 'POST') {
    const { name, description, settings } = req.body;
    if (!name || typeof name !== 'string' || !settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid input' });
    }
    const id = 'preset_' + Date.now();
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');
        const data = userDoc.data();
        const presets = Array.isArray(data.metronomePresets) ? data.metronomePresets : [];
        if (presets.length >= 4) throw new Error('Preset limit reached');
        const now = admin.firestore.FieldValue.serverTimestamp();
        const newPreset = { id, name, description: description || '', createdAt: now, updatedAt: now, settings };
        t.update(userRef, { metronomePresets: [...presets, newPreset] });
      });
      const userDoc = await db.collection('users').doc(uid).get();
      const data = userDoc.data();
      const preset = (data.metronomePresets || []).find((p) => p.id === id);
      res.status(201).json(preset);
    } catch (error) {
      if (error.message === 'Preset limit reached') return res.status(400).json({ message: 'Preset limit reached' });
      if (error.message === 'User not found') return res.status(404).json({ message: 'User not found' });
      res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
    return;
  }

  if (req.method === 'PUT') {
    const { presetId, name, description, settings } = req.body;
    if (!presetId || !name || typeof name !== 'string' || !settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid input' });
    }
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');
        const data = userDoc.data();
        const presets = Array.isArray(data.metronomePresets) ? data.metronomePresets : [];
        const idx = presets.findIndex((p) => p.id === presetId);
        if (idx === -1) throw new Error('Preset not found');
        const updatedPreset = {
          ...presets[idx],
          name,
          description: description || '',
          settings,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const newPresets = [...presets];
        newPresets[idx] = updatedPreset;
        t.update(userRef, { metronomePresets: newPresets });
      });
      const userDoc = await db.collection('users').doc(uid).get();
      const data = userDoc.data();
      const preset = (data.metronomePresets || []).find((p) => p.id === presetId);
      res.status(200).json(preset);
    } catch (error) {
      if (error.message === 'Preset not found') return res.status(404).json({ message: 'Preset not found' });
      if (error.message === 'User not found') return res.status(404).json({ message: 'User not found' });
      res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { presetId } = req.body;
    if (!presetId) return res.status(400).json({ message: 'Invalid input' });
    try {
      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');
        const data = userDoc.data();
        const presets = Array.isArray(data.metronomePresets) ? data.metronomePresets : [];
        const newPresets = presets.filter((p) => p.id !== presetId);
        if (newPresets.length === presets.length) throw new Error('Preset not found');
        t.update(userRef, { metronomePresets: newPresets });
      });
      res.status(204).end();
    } catch (error) {
      if (error.message === 'Preset not found') return res.status(404).json({ message: 'Preset not found' });
      if (error.message === 'User not found') return res.status(404).json({ message: 'User not found' });
      res.status(500).json({ message: 'Internal Server Error', error: error.toString() });
    }
    return;
  }

  res.status(405).json({ message: 'Method not allowed' });
};
