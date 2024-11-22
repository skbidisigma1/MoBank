document.addEventListener('DOMContentLoaded', async () => {
  await window.auth0Promise;

  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) {
    window.location.href = '/pages/login.html';
    return;
  }

  fetchLeaderboardData();
});

async function fetchLeaderboardData() {
  const loader = document.getElementById('loader');
  const leaderboardBody = document.getElementById('leaderboard-body');

  try {
    loader.style.display = 'block';

    const token = await auth0Client.getTokenSilently();

    const response = await fetch('/api/getLeaderboard', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard data');
    }

    const data = await response.json();

    loader.style.display = 'none';

    populateLeaderboard(data);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    loader.style.display = 'none';

    const main = document.querySelector('main');
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'Unable to load leaderboard at this time. Please try again later.';
    errorMessage.classList.add('error-message');
    main.appendChild(errorMessage);
  }
}
