const queryAll = selector => document.querySelectorAll(selector);

function parseNotificationTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (value?._seconds != null) return value._seconds * 1000 + (value._nanoseconds || 0) / 1e6;
  if (value?.seconds != null) return value.seconds * 1000 + (value.nanoseconds || 0) / 1e6;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function relativeNotificationTime(timestamp) {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000 | 0);
  const minutes = seconds / 60 | 0;
  const hours = minutes / 60 | 0;
  const days = hours / 24 | 0;
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

async function initNotifications(header, loggedIn) {
  const icon = header.querySelector('#notification-icon');
  const countElement = header.querySelector('#notification-count');
  const dropdown = header.querySelector('#notification-dropdown');
  if (!icon || !dropdown || !countElement) return;

  let notifications = [];
  let unread = 0;

  function render() {
    countElement.textContent = String(unread);
    countElement.classList.toggle('hidden', unread === 0);
    dropdown.replaceChildren();

    if (!notifications.length) {
      const empty = document.createElement('p');
      empty.className = 'notification-empty';
      empty.textContent = 'No notifications';
      dropdown.appendChild(empty);
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'notification-header';
    const title = document.createElement('h4');
    title.textContent = `Notifications (${unread} unread)`;
    const clearButton = document.createElement('button');
    clearButton.className = 'notification-clear';
    clearButton.type = 'button';
    clearButton.textContent = 'Clear all';
    clearButton.addEventListener('click', clearAll);
    heading.append(title, clearButton);
    dropdown.appendChild(heading);

    notifications.forEach((notification, index) => {
      const timestamp = parseNotificationTimestamp(notification.timestamp);
      const item = document.createElement('div');
      item.className = `notification-item ${notification.read ? '' : 'unread'}`;
      item.style.setProperty('--item-index', index);
      const message = document.createElement('div');
      message.className = 'notification-message';
      message.textContent = notification.message || 'Notification';
      const time = document.createElement('span');
      time.className = 'notification-time';
      time.dataset.ts = String(timestamp);
      time.textContent = relativeNotificationTime(timestamp);
      item.append(message, time);
      item.addEventListener('click', () => handleNotificationClick(notification));
      dropdown.appendChild(item);
    });
  }

  async function loadFromUser() {
    let attempts = 0;
    while (!window.userDataPromise && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }

    let data = null;
    try {
      data = await window.userDataPromise;
    } catch (error) {
      console.warn('Notifications: userDataPromise rejected:', error);
    }
    if (!data && typeof CACHE !== 'undefined') {
      try { data = CACHE.read(CACHE.USER_KEY); } catch {}
    }

    notifications = Array.isArray(data?.notifications) ? [...data.notifications] : [];
    unread = notifications.filter(notification => !notification.read).length;
    render();
  }

  async function markAllRead() {
    if (!loggedIn || !unread) return;
    const previous = notifications;
    notifications = notifications.map(notification => ({ ...notification, read: true }));
    unread = 0;
    render();
    try {
      const token = await auth0Client.getTokenSilently();
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAsRead' })
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      CACHE?.remove?.(CACHE.USER_KEY);
    } catch (error) {
      notifications = previous;
      unread = notifications.filter(notification => !notification.read).length;
      render();
      console.error('mark read failed:', error);
    }
  }

  async function clearAll(event) {
    event.stopPropagation();
    dropdown.querySelectorAll('.notification-item').forEach(element => element.classList.add('fadeout'));
    const previous = notifications;
    notifications = [];
    unread = 0;
    setTimeout(render, 500);
    try {
      const token = await auth0Client.getTokenSilently();
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAll' })
      });
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
      CACHE?.remove?.(CACHE.USER_KEY);
    } catch (error) {
      notifications = previous;
      unread = notifications.filter(notification => !notification.read).length;
      render();
      console.error('clear notifications failed:', error);
    }
  }

  function handleNotificationClick(notification) {
    const url =
      notification.type === 'admin_transfer' ? 'dashboard' :
      notification.type === 'transfer_received' || notification.type === 'user_transfer' ? 'transfer' :
      notification.type === 'announcement' ? `${location.origin}?showAnnouncements=true&announcementId=${encodeURIComponent(notification.announcementId || '')}` :
      '';
    if (url) location.href = url;
  }

  const toggle = event => {
    event.preventDefault();
    event.stopPropagation();
    dropdown.classList.toggle('visible');
    icon.classList.toggle('active');
    if (dropdown.classList.contains('visible')) markAllRead();
  };
  icon.addEventListener('click', toggle);
  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target) && event.target !== icon) {
      dropdown.classList.remove('visible');
      icon.classList.remove('active');
    }
  });

  setInterval(() => {
    queryAll('[data-ts]').forEach(element => {
      element.textContent = relativeNotificationTime(Number(element.dataset.ts));
    });
  }, 60_000);

  await loadFromUser();
}
