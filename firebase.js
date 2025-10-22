const admin = require('firebase-admin');

if (!admin.apps.length) {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_B64 is missing from environment variables');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (err) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_B64: ' + err.message);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
