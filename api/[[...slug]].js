const rateLimit = require('express-rate-limit');

const createLimiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
    keyGenerator: (req) =>
      (req.auth?.payload?.sub) ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      ''
  });

const regularLimiter = createLimiter(200);
const adminLimiter   = createLimiter(600);

const enforceRateLimit = (req, res) =>
  new Promise((resolve) => {
    const roles = req.auth?.payload?.['https://mo-classroom.us/roles'] || [];
    const isAdmin = roles.includes('admin');
    const limiter = isAdmin ? adminLimiter : regularLimiter;
    limiter(req, res, () => resolve());
  });

const handlers = {};

const profiler = {
  startTime: {},
  start: (label) => {
    profiler.startTime[label] = process.hrtime();
  },
  end: (label) => {
    const diff = process.hrtime(profiler.startTime[label]);
    return (diff[0] * 1e9 + diff[1]) / 1e6;
  },
};

const parseBody = (req) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 1e6 || contentLength === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
};

function getRoutePath(url) {
  const apiIndex = url.indexOf('/api/');
  if (apiIndex === -1) return '';

  let path = url.substring(apiIndex + 5);
  const queryIndex = path.indexOf('?');
  if (queryIndex !== -1) path = path.substring(0, queryIndex);
  if (path.endsWith('/')) path = path.slice(0, -1);

  return path || '';
}

module.exports = async (req, res) => {
  profiler.start('total-request');

  await enforceRateLimit(req, res);
  if (res.headersSent) return;

  try {
    const contentType = req.headers['content-type'] || '';
    if (
      (req.method === 'POST' || req.method === 'PUT') &&
      (contentType.includes('application/json') || contentType === '')
    ) {
      profiler.start('body-parsing');
      req.body = await parseBody(req);
      profiler.end('body-parsing');
    } else {
      req.body = {};
    }

    profiler.start('path-extraction');
    const routePath = getRoutePath(req.url);
    profiler.end('path-extraction');

    if (!routePath) {
      return res.status(404).json({ message: 'API endpoint not found' });
    }

    const handlerPath = `../routes/${routePath}`;

    try {
      profiler.start('handler-loading');
      const handler = handlers[routePath] || (handlers[routePath] = require(handlerPath));
      profiler.end('handler-loading');

      profiler.start('handler-execution');
      const result = await handler(req, res);
      profiler.end('handler-execution');

      profiler.end('total-request');
      return result;
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return res.status(404).json({ message: `API endpoint '${routePath}' not found` });
      }

      return res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : error.toString(),
      });
    }
  } catch (error) {
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.toString(),
    });
  }
};