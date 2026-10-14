const jwt = require('jsonwebtoken');

/**
 * Cross-subdomain session management for *.mo-classroom.us
 */

const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days (604,800 seconds)

function getSecretKey() {
  const secret = process.env.SESSION_SECRET || process.env.SHARED_SESSION_SECRET;
  if (!secret) {
    return null;
  }
  return secret;
}

/**
 * Signs a cross-subdomain JWT session token using HS256.
 * Uses dynamic import('jose') with fallback to jsonwebtoken for maximum CommonJS compatibility.
 * @param {{ email: string, sub: string }} user
 * @param {number} [maxAgeSeconds]
 * @returns {Promise<string>}
 */
async function createSessionToken(user, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error('SESSION_SECRET is not configured');
  }

  if (!user || !user.email) {
    throw new Error('User email is required to issue session token');
  }

  const payload = {
    email: user.email.toLowerCase().trim(),
    sub: user.sub || ''
  };

  try {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(secretKey);
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${maxAgeSeconds}s`)
      .sign(secret);
  } catch (_) {
    return jwt.sign(payload, secretKey, {
      algorithm: 'HS256',
      expiresIn: maxAgeSeconds
    });
  }
}

/**
 * Verifies a cross-subdomain JWT session token.
 * @param {string} token
 * @returns {Promise<any>}
 */
async function verifySessionToken(token) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error('SESSION_SECRET is not configured');
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, { algorithms: ['HS256'] }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  }
}

/**
 * Formats a Set-Cookie header string for mo_session.
 * @param {string} sessionToken
 * @param {{ host?: string, isSecure?: boolean, maxAgeSeconds?: number }} [options]
 * @returns {string}
 */
function createSessionCookie(sessionToken, options = {}) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'mo_session';
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

  let domain = process.env.SESSION_COOKIE_DOMAIN;
  if (!domain) {
    // In production or when the request host contains mo-classroom.us, use wildcard subdomain
    if (process.env.NODE_ENV === 'production' || options.host?.includes('mo-classroom.us')) {
      domain = '.mo-classroom.us';
    }
  }

  const isSecure = process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    Boolean(options.isSecure) ||
    Boolean(options.host?.includes('mo-classroom.us'));

  const parts = [
    `${cookieName}=${sessionToken}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Formats a Set-Cookie header string to clear mo_session.
 * @param {{ host?: string, isSecure?: boolean }} [options]
 * @returns {string}
 */
function clearSessionCookie(options = {}) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'mo_session';

  let domain = process.env.SESSION_COOKIE_DOMAIN;
  if (!domain) {
    if (process.env.NODE_ENV === 'production' || options.host?.includes('mo-classroom.us')) {
      domain = '.mo-classroom.us';
    }
  }

  const isSecure = process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    Boolean(options.isSecure) ||
    Boolean(options.host?.includes('mo-classroom.us'));

  const parts = [
    `${cookieName}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Safely appends or sets a Set-Cookie header on a response object.
 * @param {any} res
 * @param {string} cookieString
 */
function setCookieHeader(res, cookieString) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieString);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieString]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookieString]);
  }
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  createSessionCookie,
  clearSessionCookie,
  setCookieHeader,
  DEFAULT_MAX_AGE_SECONDS
};
