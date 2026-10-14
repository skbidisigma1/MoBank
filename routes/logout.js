const { clearSessionCookie, setCookieHeader } = require('../session');

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const host = req.headers.host || '';
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.secure);
    const cookieHeader = clearSessionCookie({ host, isSecure });
    setCookieHeader(res, cookieHeader);
    return res.status(200).json({ message: 'Session cookie cleared successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

