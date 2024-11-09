require('dotenv').config();
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./keys/mo-bank-firebase-adminsdk-ynglt-6cbe523bdc.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://<your-project-id>.firebaseio.com"
});

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/header.html', express.static(path.join(__dirname, 'header.html')));
app.use('/footer.html', express.static(path.join(__dirname, 'footer.html')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const jwtCheck = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
});

app.get('/admin', jwtCheck, async (req, res) => {
    const roles = req.user['https://mo-bank.vercel.app/roles'] || [];
    const isAdmin = roles.includes('admin');
    if (isAdmin) {
        res.sendFile(path.join(__dirname, 'adminContent.html'));
    } else {
        res.status(403).send('Forbidden: Admins only');
    }
});

app.use('/pages', express.static(path.join(__dirname, 'pages')));

app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        res.status(401).send('Invalid token');
    } else {
        next(err);
    }
});

async function addUser(uid, email, metadata = {}) {
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
        email: email,
        ...metadata
    }, { merge: true });
}

async function addTransaction(senderId, receiverId, amount) {
    const transactionRef = db.collection('transactions').doc();
    await transactionRef.set({
        senderId,
        receiverId,
        amount,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function getUserData(uid) {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    return userDoc.exists ? userDoc.data() : null;
}

app.post('/login', jwtCheck, async (req, res) => {
    const uid = req.user.sub;
    const email = req.user.email;
    const roles = req.user['https://mo-bank.vercel.app/roles'] || [];
    await addUser(uid, email, { roles });
    res.sendStatus(200);
});

app.post('/transactions', jwtCheck, async (req, res) => {
    const roles = req.user['https://mo-bank.vercel.app/roles'] || [];
    if (!roles.includes('admin')) {
        return res.status(403).send('Forbidden: Admins only');
    }
    const { senderId, receiverId, amount } = req.body;
    await addTransaction(senderId, receiverId, amount);
    res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});