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
  setupParticleConfigButton($footer);
  setupMobileMenu($header);
  window.userDataPromise = isLoggedIn ? fetchAndCacheUserData() : Promise.resolve(null);
  await initNotifications($header, isLoggedIn);
  if (isLoggedIn) {
    try {
      window.userDataPromise.then((ud) => {
        if (!ud) return;
        const cp = ud.class_period;
        const current = location.pathname.split('/').pop();
        const isProfile = current === 'profile' || current === 'profile.html';
        const protectedPages = [
          'dashboard.html','admin.html','transfer.html','leaderboard.html','cute.html',
          'dashboard','admin','transfer','leaderboard','cute'
        ];
        const privacyPages = ['privacy.html','privacy','tos.html','tos'];
        if (!isProfile && protectedPages.includes(current) && (cp === null || typeof cp === 'undefined')) {
          location.replace('profile?welcome=1');
        }
        if (privacyPages.includes(current) && (cp !== null && typeof cp !== 'undefined')) {
          window.auth0Promise = Promise.resolve();
          return;
        }
      });
    } catch (e) {
      console.warn('class_period redirect check failed:', e);
    }
  }
  
  await initializeParticleSettings();
})().catch(console.error);

/* helpers */
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

/* ---------- mobile menu ---------- */
function setupMobileMenu($header) {
  try {
    const toggleBtn = $header.querySelector('#mobileMenuToggle');
    const mobileNav = $header.querySelector('.mobile-nav');
    if (!toggleBtn || !mobileNav) return;

    const closeOnOutside = (e) => {
      if (!mobileNav.contains(e.target) && e.target !== toggleBtn) {
        closeMenu();
      }
    };

    function openMenu() {
      mobileNav.classList.add('active');
      toggleBtn.classList.add('active');
      toggleBtn.setAttribute('aria-expanded', 'true');
      // Defer attaching outside listener to next tick to avoid same-event closing quirks on some mobile browsers
      setTimeout(() => document.addEventListener('click', closeOnOutside, { once: true }), 0);
    }

    function closeMenu() {
      mobileNav.classList.remove('active');
      toggleBtn.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    let touchTriggered = false; // prevent duplicate click after touch
    const handleToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = mobileNav.classList.contains('active');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };

    // Touch handler (fires before synthetic click)
    toggleBtn.addEventListener('touchstart', (e) => {
      touchTriggered = true;
      handleToggle(e);
    }, { passive: false });

    // Pointer devices / keyboard activation
    toggleBtn.addEventListener('click', (e) => {
      if (touchTriggered) { // ignore the synthetic click following touchstart
        touchTriggered = false;
        return;
      }
      handleToggle(e);
    });

    // Optional: close menu on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
        closeMenu();
      }
    });
  } catch (err) {
    console.warn('setupMobileMenu error:', err);
  }
}

/* PWA manifest injection */
if (!document.querySelector('link[rel="manifest"]')) {
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = '/manifest.json';
  document.head.appendChild(l);
}