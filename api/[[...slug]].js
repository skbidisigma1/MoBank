const handlers = {};

const profiler = {
  startTime: {},
  
  start: (label) => {
    profiler.startTime[label] = process.hrtime();
  },
  
  end: (label) => {
    const diff = process.hrtime(profiler.startTime[label]);
    const ms = (diff[0] * 1e9 + diff[1]) / 1e6;
    // Logging removed for efficiency
    return ms;
  }
};

const parseBody = (req) => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 1e6 || contentLength === 0) return Promise.resolve({});

  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } 
      catch (e) { resolve({}); }
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
  
  try {
    const contentType = req.headers['content-type'] || '';
    if ((req.method === 'POST' || req.method === 'PUT') && 
        (contentType.includes('application/json') || contentType === '')) {
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
      let handler;
      if (handlers[routePath]) {
        handler = handlers[routePath];
        // Logging removed for efficiency
      } else {
        // Logging removed for efficiency
        handler = require(handlerPath);
        handlers[routePath] = handler;
      }
      profiler.end('handler-loading');
      
      // Logging removed for efficiency
      profiler.start('handler-execution');
      const result = await handler(req, res);
      profiler.end('handler-execution');
      
      const totalTime = profiler.end('total-request');
      // Logging removed for efficiency
      
      return result;
      } catch (error) {
      // Logging removed for efficiency
      
      if (error.code === 'MODULE_NOT_FOUND') {
        return res.status(404).json({ message: `API endpoint '${routePath}' not found` });
      }
      
      return res.status(500).json({ 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : error.toString()
      });
    }
  } catch (error) {
    // Logging removed for efficiency
    return res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'production' ? undefined : error.toString()
    });
  }
};