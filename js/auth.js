async function initializeUser() {
  try {
    const token = await getToken();
    if (!token) return;
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      console.error(`Error initializing user: ${errorData.message}. Please refresh the page.`);
    }
  } catch (error) {
    console.error(`Error initializing user: ${error}. Please refresh the page.`);
  }
}

let auth0Client = null;

const protectedPages = ['dashboard.html', 'admin.html', 'transfer.html', 'leaderboard.html'];

const auth0Promise = (async () => {
  auth0Client = await createAuth0Client({
    domain: 'dev-nqdfwemz14t8nf7w.us.auth0.com',
    client_id: 'IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA',
    redirect_uri: window.location.origin + '/pages/dashboard.html',
    audience: 'https://mo-bank.vercel.app/api',
    cacheLocation: 'localstorage',
    useRefreshTokens: true
  });
  await handleAuthRedirect();
  const currentPage = window.location.pathname.split('/').pop();
  const isProtected = protectedPages.includes(currentPage);
  const isAuthenticated = await auth0Client.isAuthenticated();
  if (isProtected) {
    if (isAuthenticated) {
      await initializeUser();
    } else {
      window.location.href = '/login.html';
    }
  }
})();

async function signInWithAuth0() {
  try {
    await auth0Client.loginWithRedirect({
      connection: 'google-oauth2',
      prompt: 'select_account'
    });
  } catch (error) {
    console.error('Auth0 Login Error:', error);
  }
}

async function handleAuthRedirect() {
  const query = window.location.search;
  if (query.includes('code=') && query.includes('state=')) {
    try {
      await auth0Client.handleRedirectCallback();
      const targetUrl = '/pages/dashboard.html';
      window.history.replaceState({}, document.title, targetUrl);
    } catch (error) {
      console.error('Auth0 Callback Error:', error);
    }
  }
}

async function logoutUser() {
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      },
      federated: false
    });
    const cacheKey = '@@auth0spajs@@::IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA::dev-nqdfwemz14t8nf7w.us.auth0.com::openid profile email offline_access';
    localStorage.removeItem(cacheKey);
    sessionStorage.clear();
  } catch (error) {
    console.error('Auth0 Logout Error:', error);
  }
}

async function isAuthenticated() {
  try {
    return await auth0Client.isAuthenticated();
  } catch (error) {
    console.error('Auth0 isAuthenticated Error:', error);
    return false;
  }
}

async function getUser() {
  try {
    return await auth0Client.getUser();
  } catch (error) {
    console.error('Auth0 getUser Error:', error);
    return null;
  }
}

async function getToken() {
  try {
    return await auth0Client.getTokenSilently();
  } catch (error) {
    console.error('Auth0 getTokenSilently Error:', error);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await auth0Promise;

  const signInButton = document.getElementById('auth0-signin');
  if (signInButton) {
    signInButton.addEventListener('click', signInWithAuth0);
  }
});

window.signInWithAuth0 = signInWithAuth0;
window.logoutUser = logoutUser;
window.isAuthenticated = isAuthenticated;
window.getUser = getUser;
window.getToken = getToken;
window.auth0Promise = auth0Promise;