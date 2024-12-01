document.addEventListener('DOMContentLoaded', async () => {
  await window.auth0Promise;

  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) {
    window.location.href = '/pages/login.html';
    return;
  }

  const user = await getUser();
  const roles = (user && user['https://mo-bank.vercel.app/roles']) || [];
  const isAdmin = roles.includes('admin');

  let currentPeriod;

  try {
    const token = await auth0Client.getTokenSilently();
    const response = await fetch('/api/getUserData', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) {
      const userData = await response.json();
      currentPeriod = userData.class_period;
    } else {
      currentPeriod = 5;
    }
  } catch (error) {
    currentPeriod = 5;
  }

  const periodButtons = document.getElementById('period-buttons');
  if (isAdmin) {
    periodButtons.classList.remove('hidden');
    const buttons = periodButtons.querySelectorAll('.period-button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        const period = parseInt(button.dataset.period, 10);
        currentPeriod = period;
        fetchLeaderboardData(period);
        const title = document.getElementById('leaderboard-title');
        title.textContent = `Leaderboard - Period ${period}`;
      });
    });
  }

  fetchLeaderboardData(currentPeriod);
  const title = document.getElementById('leaderboard-title');
  title.textContent = `Leaderboard - Period ${currentPeriod}`;
});

async function fetchLeaderboardData(period) {
  const leaderboardBody = document.getElementById('leaderboard-body');
  const lastUpdatedElement = document.getElementById('last-updated');

  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch(`/api/getAggregatedLeaderboard?period=${period}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leaderboard data');
    }

    const data = await response.json();

    populateLeaderboard(data);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);

    const main = document.querySelector('main');
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'Unable to load leaderboard at this time. Please try again later.';
    errorMessage.classList.add('error-message');
    main.appendChild(errorMessage);
  }
}

function populateLeaderboard(data) {
  const leaderboardBody = document.getElementById('leaderboard-body');
  const lastUpdatedElement = document.getElementById('last-updated');

  leaderboardBody.innerHTML = '';

  const leaderboardData = data.leaderboardData;

  leaderboardData.forEach((user, index) => {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = index + 1;
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

    leaderboardBody.appendChild(row);
  });

  if (data.lastUpdated && data.lastUpdated._seconds) {
    const lastUpdatedDate = new Date(data.lastUpdated._seconds * 1000);
    lastUpdatedElement.textContent = `Last Updated: ${lastUpdatedDate.toLocaleString()}`;
  } else {
    lastUpdatedElement.textContent = '';
  }
}
