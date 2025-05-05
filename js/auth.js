let auth0Client = null;
const protectedPages = [
  'dashboard.html', 'admin.html', 'transfer.html', 'leaderboard.html',
  'dashboard', 'admin', 'transfer', 'leaderboard'
];

const auth0Promise = (async () => {
  auth0Client = await createAuth0Client({
    domain: 'dev-nqdfwemz14t8nf7w.us.auth0.com',
    client_id: 'IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA',
    redirect_uri: `${window.location.origin}/dashboard`,
    audience: 'https://mo-classroom.us/api',
    cacheLocation: 'localstorage',
    useRefreshTokens: true
  });

  await handleAuthRedirect();

  const currentPage = window.location.pathname.split('/').pop();
  const isProtected = protectedPages.includes(currentPage);

  if (isProtected) {
    const token = await getToken();
    if (token) {
      await initializeUser(token);
    } else {
      window.location.href = 'login';
    }
  }
})();

async function getToken() {
  try {
    return await auth0Client.getTokenSilently({ ignoreCache: true });
  } catch (e) {
    if (e.error === 'login_required' ||
        e.error === 'consent_required' ||
        e.error === 'interaction_required') {
      console.warn('No active session:', e.error);
      return null;
    }
    console.error('getTokenSilently error:', e);
    return null;
  }
}

async function isAuthenticated() {
  try {
    return await auth0Client.isAuthenticated();
  } catch (e) {
    console.error('isAuthenticated error:', e);
    return false;
  }
}

async function getUser() {
  try {
    return await auth0Client.getUser();
  } catch (e) {
    console.error('getUser error:', e);
    return null;
  }
}

async function initializeUser(token) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const msg = await res.text();
      console.error('Init error:', msg);
      showToast('Initialization Error', `Error initializing user: ${msg}`);
    }
  } catch (e) {
    console.error('Init error:', e);
    showToast('Initialization Error', `Error initializing user: ${e}`);
  }
}

async function signInWithAuth0() {
  try {
    await auth0Client.loginWithRedirect({
      redirect_uri: `${window.location.origin}/dashboard`,
      connection: 'google-oauth2',
      prompt: 'select_account'
    });
  } catch (e) {
    console.error('login error:', e);
  }
}

async function handleAuthRedirect() {
  const q = window.location.search;
  if (q.includes('code=') && q.includes('state=')) {
    try {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, '/dashboard');
    } catch (e) {
      console.error('callback error:', e);
    }
  }
}

async function logoutUser() {
  try {
    await auth0Client.logout({
      logoutParams: { returnTo: window.location.origin },
      federated: false
    });
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach(c => {
      const eq = c.indexOf('=');
      const name = eq > -1 ? c.substr(0, eq) : c;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (e) {
    console.error('logout failed:', e);
  }
}

function isValidUrl(u) {
  try {
    const url = new URL(u, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

document.addEventListener('DOMContentLoaded', () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  document.querySelectorAll('.pwa-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const url = link.getAttribute('data-url');
      if (!url || !isValidUrl(url)) return;
      const safeUrl = encodeURI(url);
      isPWA
        ? window.open(safeUrl, '_blank', 'noopener,noreferrer,width=800,height=600')
        : window.location.href = safeUrl;
    });
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  await auth0Promise;
  const btn = document.getElementById('auth0-signin');
  if (btn) btn.addEventListener('click', signInWithAuth0);
});

window.signInWithAuth0 = signInWithAuth0;
window.logoutUser     = logoutUser;
window.isAuthenticated = isAuthenticated;
window.getUser        = getUser;
window.getToken       = getToken;
window.auth0Promise   = auth0Promise;