const { verifyToken, getTokenFromHeader } = require('../auth-helper');
const { db } = require('../firebase');

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

module.exports = async (req, res) => {
  profiler.start('notifications-total');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    profiler.start('jwt-verification');
    const decoded = await verifyToken(token);
    profiler.end('jwt-verification');
    
    const userId = decoded.sub;
    
    const { action } = req.body || {};

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }    if (!action) {
      return res.status(400).json({ message: 'Missing action parameter' });
    }

    if (action === 'markAsRead') {
      const notifications = userDoc.data().notifications || [];
      const updatedNotifications = notifications.map(notification => ({
        ...notification,
        read: true
      }));

      await userRef.update({ notifications: updatedNotifications });
      return res.status(200).json({ message: 'All notifications marked as read' });
    } else if (action === 'clearAll') {
      await userRef.update({ notifications: [] });
      return res.status(200).json({ message: 'All notifications cleared' });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (err) {
    console.error('Notification handler error:', err);
    profiler.end('notifications-total');
    return res.status(500).json({ message: 'Internal Server Error', error: err.toString() });
  }
};