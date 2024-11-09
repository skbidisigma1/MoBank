let auth0Client = null;

const auth0Promise = (async () => {
  auth0Client = await createAuth0Client({
    domain: 'dev-nqdfwemz14t8nf7w.us.auth0.com',
    client_id: 'IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA',
    redirect_uri: window.location.origin + '/pages/dashboard.html',
    audience: 'https://mo-bank.vercel.app/api',
    cacheLocation: 'localstorage',
    useRefreshTokens: true,
  });
  await handleAuthRedirect();
  await checkSilentAuth();
})();

async function signInWithAuth0() {
  try {
    await auth0Client.loginWithRedirect({
      connection: 'google-oauth2',
      prompt: 'select_account',
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
      const token = await auth0Client.getTokenSilently();
      await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.error('Auth0 Callback Error:', error);
    }
  }
}

async function logoutUser() {
  try {
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
      federated: false,
    });
    localStorage.removeItem('auth0.is.authenticated');
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

async function checkSilentAuth() {
  try {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      const user = await getUser();
      const loginStatus = document.getElementById('login-status');
      if (loginStatus) {
        loginStatus.textContent = `Welcome, ${user.name}!`;
      }
    } else {
      console.log('User is not authenticated.');
    }
  } catch (error) {
    console.error('Silent Authentication Error:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await auth0Promise;
});

window.signInWithAuth0 = signInWithAuth0;
window.logoutUser = logoutUser;
window.isAuthenticated = isAuthenticated;
window.getUser = getUser;
window.getToken = getToken;
window.auth0Promise = auth0Promise;