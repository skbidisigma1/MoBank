const admin = require('firebase-admin');

if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 missing');

  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

  const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = json;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Service account JSON missing required fields');
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();
module.exports = { admin, db };
