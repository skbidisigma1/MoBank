const rateLimit = require('express-rate-limit');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const createLimiter = max =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
    keyGenerator: req => {
      const key =
    req.auth?.payload?.sub ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '';
  console.log('🔑 Rate key being used:', key);
  return key;
    }
  });

const regularLimiter = createLimiter(400);
const adminLimiter = createLimiter(750);

const attachAuth = async req => {
  const token = getTokenFromHeader(req);
  if (!token) return;
  try {
    const decoded = await verifyToken(token);
    req.auth = { payload: decoded };
  } catch {}
};

const enforceRateLimit = (req, res) =>
  new Promise(resolve => {
    const roles = req.auth?.payload?.['https://mo-classroom.us/roles'] || [];
    (roles.includes('admin') ? adminLimiter : regularLimiter)(req, res, () => resolve());
  });

const handlers = {};
const profiler = {
  t: {},
  start: l => (profiler.t[l] = process.hrtime()),
  end: l => {
    const d = process.hrtime(profiler.t[l]);
    return (d[0] * 1e9 + d[1]) / 1e6;
  }
};

const parseBody = req =>
  new Promise(resolve => {
    const len = +req.headers['content-length'] || 0;
    if (!len || len > 1e6) return resolve({});
    let b = '';
    req.on('data', c => (b += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(b));
      } catch {
        resolve({});
      }
    });
  });

const getRoutePath = url => {
  const i = url.indexOf('/api/');
  if (i === -1) return '';
  let p = url.slice(i + 5);
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  if (p.endsWith('/')) p = p.slice(0, -1);
  return p || '';
};

module.exports = async (req, res) => {
  profiler.start('total');
  await attachAuth(req);
  await enforceRateLimit(req, res);
  if (res.headersSent) return;
  try {
    const ct = req.headers['content-type'] || '';
    if (['POST', 'PUT'].includes(req.method) && (ct.includes('application/json') || !ct))
      req.body = await parseBody(req);
    else req.body = {};
    const routePath = getRoutePath(req.url);
    if (!routePath) return res.status(404).json({ message: 'API endpoint not found' });
    const handler = handlers[routePath] || (handlers[routePath] = require(`../routes/${routePath}`));
    await handler(req, res);
  } catch (e) {
    if (!res.headersSent)
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : e.toString()
      });
  } finally {
    profiler.end('total');
  }
};