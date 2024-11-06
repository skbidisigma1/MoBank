let auth0Client = null;

export async function initializeAuth0() {
  auth0Client = await createAuth0Client({
    domain: "dev-nqdfwemz14t8nf7w.us.auth0.com",
    client_id: "IJVNKTUu7mlBsvxDhdNNYOOtTXfFOtqA",
    cacheLocation: 'localstorage',
  });

  const query = window.location.search;
  if (query.includes("code=") && query.includes("state=")) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    const user = await auth0Client.getUser();
    showUserProfile(user);
  } else {
    hideUserProfile();
  }
}

function showUserProfile(user) {
  const profilePicture = document.getElementById('profile-picture');
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');

  if (profilePicture && userName && userEmail) {
    profilePicture.src = user.picture;
    profilePicture.style.display = 'block';

    userName.textContent = user.name;
    userEmail.textContent = user.email;
  }
}

function hideUserProfile() {
  const profilePicture = document.getElementById('profile-picture');
  const dropdownMenu = document.getElementById('dropdown-menu');

  if (profilePicture && dropdownMenu) {
    profilePicture.style.display = 'none';
    dropdownMenu.classList.remove('show');
  }
}

export async function signInWithAuth0() {
  await auth0Client.loginWithRedirect({
    connection: 'google-oauth2',
  });
}

export async function signOutWithAuth0() {
  await auth0Client.logout({
    returnTo: window.location.origin,
  });
}

export function toggleDropdownMenu() {
  const dropdownMenu = document.getElementById('dropdown-menu');
  if (dropdownMenu) {
    dropdownMenu.classList.toggle('show');
  }
}