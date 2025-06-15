/* Loads header & footer, manages auth-aware links + notifications  */
(async () => {
  await documentReady();

  const [$header, $footer] = await Promise.all([
    fetchFragment(headerPath()).then(insert('#header-placeholder')),
    fetchFragment(footerPath()).then(insert('#footer-placeholder'))
  ]);
  await window.auth0Promise;
  const isLoggedIn = await isAuthenticated();

  const user = isLoggedIn ? await getUser() : null;
  setupNavLinks($header, isLoggedIn, user);
  setupProfilePic($header, user);
  await initNotifications($header, isLoggedIn);
  // kick off a fresh user-data fetch for the whole app
  window.userDataPromise = isLoggedIn ? fetchAndCacheUserData() : Promise.resolve(null);
    // Update navigation links after user data is loaded
})().catch(console.error);

/* ---------- helpers ---------- */
const $$ = (sel) => document.querySelectorAll(sel);
function documentReady() {
  return new Promise((r) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', r, { once: true })
      : r()
  );
}

const insert = (sel) => async (html) => {
  const holder = document.querySelector(sel);
  holder.innerHTML = '';
  holder.append(...new DOMParser().parseFromString(html, 'text/html').body.children);
  return holder;
};

const fetchFragment = async (url) => {
  const res = await fetch(url);
  return res.ok ? res.text() : '';
};

const headerPath = () =>
  location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
const footerPath = () =>
  location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

async function fetchAndCacheUserData() {
  try {
    // Check cache first
    const cachedData = CACHE.read(CACHE.USER_KEY);
    if (cachedData) {
      return cachedData;
    }

    const token = await auth0Client.getTokenSilently();
    
    const res = await fetch('/api/getUserData', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('fetchAndCacheUserData: Request failed:', errorText);
      throw new Error(`status ${res.status}: ${errorText}`);
    }
      const responseData = await res.json();
    const data = responseData;
    
    CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
    
    return data;
  } catch (e) {
    console.error('fetchAndCacheUserData: User data fetch failed:', e);
    return null;
  }
}

/* ---------- header nav / auth ---------- */
function setupNavLinks($header, loggedIn, user = null) {
  const show = (sel, visible) => $header.querySelectorAll(sel).forEach((n) => (n.style.display = visible ? '' : 'none'));

  const roles = user?.['https://mo-classroom.us/roles'] || [];
  const isAdmin = roles.includes('admin');
  
  show('#admin-link, #admin-link-mobile', isAdmin);

  // logged-in links
  show('#leaderboard-link, #leaderboard-link-mobile', loggedIn);
  show('#dashboard-link, #dashboard-link-mobile', true);

  // auth link text/handler
  $header.querySelectorAll('#auth-link, #auth-link-mobile').forEach((lnk) => {
    if (loggedIn) {
      lnk.textContent = 'Logout';
      lnk.href = '#';      lnk.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        logoutUser();
      });
    } else {
      lnk.textContent = 'Login';
      lnk.href = 'login';
    }
  });
}

/* ---------- profile picture ---------- */
function setupProfilePic($header, user) {
  const img = $header.querySelector('#profile-pic');
  if (!img) return;

  img.src = user?.picture || '/images/default_profile.svg';
  img.addEventListener('click', () => (location.href = user ? 'dashboard' : 'login'));
}

/* ---------- notifications ---------- */
async function initNotifications($header, loggedIn) {
  const icon = $header.querySelector('#notification-icon');
  const countEl = $header.querySelector('#notification-count');
  const dropdown = $header.querySelector('#notification-dropdown');
  if (!icon || !dropdown || !countEl) return;

  let notifications = [];
  let unread = 0;

  function render() {
    countEl.textContent = unread;
    countEl.classList.toggle('hidden', unread === 0);

    dropdown.innerHTML = notifications.length
      ? `<div class="notification-header">
           <h4>Notifications (${unread} unread)</h4>
           <button class="notification-clear">Clear all</button>
         </div>`
      : '<p class="notification-empty">No notifications</p>';

    notifications.forEach((n, i) => {
      const ts = parseTimestamp(n.timestamp);
      const item = document.createElement('div');
      item.className = `notification-item ${n.read ? '' : 'unread'}`;
      item.style.setProperty('--item-index', i);
      item.innerHTML = `
        <div class="notification-message">${n.message}</div>
        <span class="notification-time" data-ts="${ts}">${relTime(ts)}</span>`;
      item.addEventListener('click', () => handleNotifClick(n));
      dropdown.appendChild(item);
    });

    dropdown.querySelector('.notification-clear')?.addEventListener('click', clearAll);
  }

  async function loadFromUser() {
    const data = await window.userDataPromise;
    if (data?.notifications) {
      notifications = [...data.notifications];
      unread = notifications.filter((n) => !n.read).length;
      render();
    }
  }

  async function markAllRead() {
    if (!loggedIn || !unread) return;
    unread = 0;
    notifications = notifications.map((n) => ({ ...n, read: true }));
    render();
    try {
      const token = await auth0Client.getTokenSilently();
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAsRead' })
      });
    } catch (e) {
      console.error('mark read failed:', e);
    }
  }

  async function clearAll(e) {
    e.stopPropagation();
    dropdown.querySelectorAll('.notification-item').forEach((el) => el.classList.add('fadeout'));
    setTimeout(render, 500);
    notifications = [];
    unread = 0;
    try {
      const token = await auth0Client.getTokenSilently();
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAll' })
      });
      localStorage.removeItem('userData');
    } catch (e) {
      console.error('clear notifications failed:', e);
    }
  }

  function handleNotifClick(n) {
    const url =
      n.type === 'admin_transfer' ? 'dashboard' :
      n.type === 'transfer_received' || n.type === 'user_transfer' ? 'transfer' :
      n.type === 'announcement' ? `${location.origin}?showAnnouncements=true&announcementId=${n.announcementId || ''}` :
      '';
    if (url) location.href = url;
  }

  /* toggle */
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle('visible');
    icon.classList.toggle('active');
    if (dropdown.classList.contains('visible')) markAllRead();
  };
  icon.addEventListener('click', toggle);
  icon.addEventListener('touchstart', toggle, { passive: false });
  document.addEventListener('click', (e) => !dropdown.contains(e.target) && dropdown.classList.remove('visible'));

  /* relative timestamp updater */
  setInterval(() => $$('[data-ts]').forEach((el) => (el.textContent = relTime(el.dataset.ts))), 60_000);

  await loadFromUser();
}

/* utilities */
const parseTimestamp = (ts) =>
  ts?._seconds * 1000 || ts?.seconds * 1000 || ts?.toDate?.().getTime() || Date.parse(ts) || Date.now();
const relTime = (ms) => {
  const diff = Date.now() - ms;
  const sec = diff / 1000 | 0, min = sec / 60 | 0, hr = min / 60 | 0, day = hr / 24 | 0;
  return sec < 60 ? 'just now' :
         min < 60 ? `${min}m ago` :
         hr < 24 ? `${hr}h ago` :
         day < 7 ? `${day}d ago` :
         new Date(ms).toLocaleDateString();
};

/* PWA manifest injection */
if (!document.querySelector('link[rel="manifest"]')) {
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = '/manifest.json';
  document.head.appendChild(l);
}