async function initializeUser() {
  const token = await getToken();
  try {
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
  const isAuthenticatedFlag = await auth0Client.isAuthenticated();
  if (isAuthenticatedFlag) {
    await initializeUser();
    await cacheUserData();
  }
  await checkSilentAuth();
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
      window.history.replaceState({}, document.title, '/pages/dashboard.html');
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
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/pages/login.html';
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
    if (error.error === 'login_required' || error.error === 'consent_required') {
      await signInWithAuth0();
    }
    return null;
  }
}

async function checkSilentAuth() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      sessionStorage.clear();
      window.location.href = '/pages/login.html';
    } else {
      const user = await getUser();
      const loginStatus = document.getElementById('login-status');
      if (loginStatus && user && user.name) {
        loginStatus.textContent = `Welcome, ${user.name}!`;
      }
      await cacheUserData();
    }
  } catch (error) {
    sessionStorage.clear();
    console.error('Silent Authentication Error:', error);
    window.location.href = '/pages/login.html';
  }
}

async function cacheUserData() {
  try {
    const token = await getToken();
    if (!token) {
      throw new Error('Authentication token is missing.');
    }

    const response = await fetch('/api/getUserData', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const userData = await response.json();
      const now = Date.now();
      sessionStorage.setItem('userData', JSON.stringify(userData));
      sessionStorage.setItem('userDataTimestamp', now.toString());
    } else if (response.status === 429) {
      console.error('Rate limit exceeded while caching user data.');
    } else if (response.status === 401) {
      console.error('Unauthorized access while caching user data.');
      sessionStorage.clear();
      window.location.href = '/pages/login.html';
    } else {
      console.error('Failed to cache user data.');
    }
  } catch (error) {
    console.error('Error caching user data:', error);
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