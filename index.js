require('dotenv').config();
const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/pages/admin.html', jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    }),
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
}), (req, res) => {
    const claims = req.user;
    console.log('User claims:', claims);
    const isAdmin = claims && claims['https://mo-bank.vercel.app/isAdmin'];
    if (isAdmin) {
        res.sendFile(path.join(__dirname, 'pages/admin.html'));
    } else {
        console.log('Access denied: Admins only');
        res.status(403).send('Forbidden: Admins only');
    }
});

app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        console.log('Invalid token');
        res.status(401).send('Invalid token');
    } else {
        next(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
