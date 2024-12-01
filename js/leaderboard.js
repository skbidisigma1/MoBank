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

    const cachedData = localStorage.getItem('cachedLeaderboardData');
    const cacheTimestamp = localStorage.getItem('cachedLeaderboardTimestamp');
    const cacheDuration = 10 * 60 * 1000;

    let data;

    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < cacheDuration) {
      data = JSON.parse(cachedData);
    } else {
      const token = await auth0Client.getTokenSilently();

      const response = await fetch('/api/getAggregatedLeaderboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }

      data = await response.json();
      localStorage.setItem('cachedLeaderboardData', JSON.stringify(data));
      localStorage.setItem('cachedLeaderboardTimestamp', Date.now());
    }

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

function populateLeaderboard(data) {
  const leaderboardBody = document.getElementById('leaderboard-body');
  leaderboardBody.innerHTML = '';

  const leaderboardData = data.leaderboardData;
  const periods = Object.keys(leaderboardData);

  let rank = 1;

  periods.forEach((period) => {
    const users = leaderboardData[period];

    users.forEach((user) => {
      const row = document.createElement('tr');

      const rankCell = document.createElement('td');
      rankCell.textContent = rank++;
      row.appendChild(rankCell);

      const nameCell = document.createElement('td');
      nameCell.textContent = user.name;
      row.appendChild(nameCell);

      const balanceCell = document.createElement('td');
      balanceCell.textContent = user.balance;
      row.appendChild(balanceCell);

      const instrumentCell = document.createElement('td');
      instrumentCell.textContent = user.instrument;
      row.appendChild(instrumentCell);

      const periodCell = document.createElement('td');
      periodCell.textContent = period;
      row.appendChild(periodCell);

      leaderboardBody.appendChild(row);
    });
  });

  const lastUpdated = document.createElement('p');
  lastUpdated.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
  lastUpdated.classList.add('last-updated');
  document.querySelector('main').appendChild(lastUpdated);
}
