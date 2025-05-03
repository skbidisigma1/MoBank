const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { promisify } = require('util');

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  cacheMaxAge: 24 * 60 * 60 * 1000,
  cacheMaxEntries: 5
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(err, err ? undefined : key.getPublicKey());
  });
}

const jwtVerify = promisify(jwt.verify);

const getTokenFromHeader = (req) => {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.substring(7) : null;
};

async function verifyToken(token) {
  return jwtVerify(
    token, 
    getKey, 
    {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256']
    }
  );
}

module.exports = {
  client,
  getKey,
  jwtVerify,
  getTokenFromHeader,
  verifyToken
};
