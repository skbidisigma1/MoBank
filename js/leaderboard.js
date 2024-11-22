document.addEventListener('DOMContentLoaded', async () => {
  await window.auth0Promise;

  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) {
    window.location.href = '/pages/login.html';
    return;
  }

  fetchLeaderboardData();
});
