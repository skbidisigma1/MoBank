const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getTokenFromHeader, verifyToken } = require('../auth-helper');

const routeLoaders = Object.freeze({
  adminAdjustBalance: () => require('../routes/adminAdjustBalance'),
  announcements: () => require('../routes/announcements'),
  cancelPracticeSession: () => require('../routes/cancelPracticeSession'),
  declineOrder: () => require('../routes/declineOrder'),
  deletePracticeSession: () => require('../routes/deletePracticeSession'),
  editPracticeSession: () => require('../routes/editPracticeSession'),
  endPracticeSession: () => require('../routes/endPracticeSession'),
  fulfillOrder: () => require('../routes/fulfillOrder'),
  getAggregatedLeaderboard: () => require('../routes/getAggregatedLeaderboard'),
  getCatalog: () => require('../routes/getCatalog'),
  getCatalogAdmin: () => require('../routes/getCatalogAdmin'),
  getItemImage: () => require('../routes/getItemImage'),
  getOrders: () => require('../routes/getOrders'),
  getOrdersAdmin: () => require('../routes/getOrdersAdmin'),
  getPracticeData: () => require('../routes/getPracticeData'),
  getPracticeTrends: () => require('../routes/getPracticeTrends'),
  getTransactions: () => require('../routes/getTransactions'),
  getTransferRecipients: () => require('../routes/getTransferRecipients'),
  getUserData: () => require('../routes/getUserData'),
  getUserNames: () => require('../routes/getUserNames'),
  logPracticeSession: () => require('../routes/logPracticeSession'),
  login: () => require('../routes/login'),
  manageCatalogItem: () => require('../routes/manageCatalogItem'),
  metronomePresets: () => require('../routes/metronomePresets'),
  notifications: () => require('../routes/notifications'),
  resetClassPeriods: () => require('../routes/resetClassPeriods'),
  setPracticeGoal: () => require('../routes/setPracticeGoal'),
  startPracticeSession: () => require('../routes/startPracticeSession'),
  submitOrder: () => require('../routes/submitOrder'),
  transferFunds: () => require('../routes/transferFunds'),
  updateProfile: () => require('../routes/updateProfile')
});

const createLimiter = max =>
  rateLimit({
    windowMs: 10 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
    keyGenerator: req => req.auth?.payload?.sub ||
      ipKeyGenerator(req.socket.remoteAddress || 'unknown')
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

const runLimiter = async (limiter, req, res) => {
  let allowed = false;
  await limiter(req, res, () => { allowed = true; });
  return allowed;
};

const enforceRateLimit = async (req, res) => {
  const roles = req.auth?.payload?.['https://mo-classroom.us/roles'] || [];
  return runLimiter(roles.includes('admin') ? adminLimiter : regularLimiter, req, res);
};

const handlers = {};
const profiler = {
  t: {},
  start: l => (profiler.t[l] = process.hrtime()),
  end: l => {
    const d = process.hrtime(profiler.t[l]);
    return (d[0] * 1e9 + d[1]) / 1e6;
  }
};

const parseBody = (req, routePath) => {
  const contentType = req.headers['content-type'] || '';
  const rawLength = req.headers['content-length'];
  const contentLength = rawLength === undefined ? 0 : Number(rawLength);
  if (contentLength === 0 && !req.headers['transfer-encoding']) {
    return { body: {} };
  }
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    return { error: 415, message: 'Content-Type must be application/json' };
  }
  const maxBytes = routePath === 'manageCatalogItem' ? 2_000_000 : 1_000_000;
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { error: 413, message: 'Request body too large' };
  }
  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return { error: 400, message: 'Invalid JSON body' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 400, message: 'Request body must be an object' };
  }
  if (Buffer.byteLength(JSON.stringify(body)) > maxBytes) {
    return { error: 413, message: 'Request body too large' };
  }
  return { body };
};

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
  const allowed = await enforceRateLimit(req, res);
  if (!allowed || res.headersSent) return;
  try {
    const routePath = getRoutePath(req.url);
    if (!routePath) return res.status(404).json({ message: 'API endpoint not found' });
    const loader = Object.hasOwn(routeLoaders, routePath) ? routeLoaders[routePath] : null;
    if (!loader) return res.status(404).json({ message: 'API endpoint not found' });
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const parsed = parseBody(req, routePath);
      if (parsed.error) return res.status(parsed.error).json({ message: parsed.message });
      req.body = parsed.body;
    }
    const handler = handlers[routePath] || (handlers[routePath] = loader());
    await handler(req, res);
  } catch (e) {
    console.error('API route failed:', e);
    if (!res.headersSent)
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : e.toString()
      });
  } finally {
    profiler.end('total');
  }
};

module.exports.__test = { parseBody, getRoutePath, runLimiter, createLimiter };
