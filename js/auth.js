let auth0Client = null;

async function initializeAuth0Client() {
  if (!auth0Client) {
    auth0Client = await createAuth0Client({
      domain: 'dev-nqdfwemz14t8nf7w.us.auth0.com',
      client_id: 'IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA',
      redirect_uri: window.location.origin + '/pages/dashboard.html',
      audience: 'https://mo-bank.vercel.app/api',
      cacheLocation: 'localstorage',
      useRefreshTokens: true
    });
  }
}

async function initializeUser() {
  try {
    const token = await getToken();
    if (!token) {
      return;
    }
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

async function handleAuthRedirect() {
  const query = window.location.search;
  if (query.includes('code=') && query.includes('state=')) {
    await initializeAuth0Client();
    try {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, '/pages/dashboard.html');
    } catch (error) {
      console.error('Auth0 Callback Error:', error);
    }
  }
}

async function signInWithAuth0() {
  try {
    await initializeAuth0Client();
    await auth0Client.loginWithRedirect({
      connection: 'google-oauth2',
      prompt: 'select_account'
    });
  } catch (error) {
    console.error('Auth0 Login Error:', error);
  }
}

async function logoutUser() {
  try {
    await initializeAuth0Client();
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      },
      federated: false
    });
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error('Auth0 Logout Error:', error);
  }
}

async function isAuthenticated() {
  try {
    await initializeAuth0Client();
    return await auth0Client.isAuthenticated();
  } catch (error) {
    console.error('Auth0 isAuthenticated Error:', error);
    return false;
  }
}

async function getUser() {
  try {
    await initializeAuth0Client();
    return await auth0Client.getUser();
  } catch (error) {
    console.error('Auth0 getUser Error:', error);
    return null;
  }
}

async function getToken() {
  try {
    await initializeAuth0Client();
    return await auth0Client.getTokenSilently();
  } catch (error) {
    console.error('Auth0 getTokenSilently Error:', error);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await initializeAuth0Client();

  const signInButton = document.getElementById('auth0-signin');
  if (signInButton) {
    signInButton.addEventListener('click', signInWithAuth0);
  }

  await handleAuthRedirect();

  const isAuth = await isAuthenticated();
  if (isAuth) {
    await initializeUser();
    window.location.href = '/pages/dashboard.html';
  }
});

window.signInWithAuth0 = signInWithAuth0;
window.logoutUser = logoutUser;
window.isAuthenticated = isAuthenticated;
window.getUser = getUser;
window.getToken = getToken;
window.auth0Client = auth0Client;