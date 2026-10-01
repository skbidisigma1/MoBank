module.exports = async function parseRequestBody(req) {
  let body = req.body;

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      const error = new Error('Invalid JSON format');
      error.code = 'INVALID_JSON';
      throw error;
    }
  } else if (body === undefined) {
    const rawContentLength = req.headers?.['content-length'];
    if (rawContentLength !== undefined && Number(rawContentLength) === 0) return {};

    let raw = '';
    try {
      await new Promise((resolve, reject) => {
        req.on('data', chunk => (raw += chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });
    } catch {
      const error = new Error('Invalid request body');
      error.code = 'INVALID_BODY';
      throw error;
    }

    try {
      body = JSON.parse(raw || '{}');
    } catch {
      const error = new Error('Invalid JSON format');
      error.code = 'INVALID_JSON';
      throw error;
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Invalid request body');
    error.code = 'INVALID_BODY';
    throw error;
  }

  return body;
};
