document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const periodButtons = document.querySelectorAll('.period-button');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const lastUpdatedElement = document.getElementById('last-updated');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const leaderboardTitle = document.getElementById('leaderboard-title');

  const CACHE_DURATION = 60 * 1000;

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }

  function showLoader() {
    loader.classList.remove('hidden');
  }

  function hideLoader() {
    loader.classList.add('hidden');
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.textContent = '';
    errorContainer.classList.add('hidden');
  }

  function populateLeaderboard(data, period) {
    leaderboardBody.innerHTML = '';
    leaderboardTitle.textContent = `Leaderboard - Period ${period}`;
    const filteredData = data.leaderboardData.filter(
      user => user.name !== 'Madison Moline'
    );
    filteredData.forEach((user, index) => {
      const row = document.createElement('tr');

      const rankCell = document.createElement('td');
      rankCell.textContent = index + 1;
      rankCell.classList.add('rank');
      row.appendChild(rankCell);

      const nameCell = document.createElement('td');
      nameCell.textContent = user.name;
      row.appendChild(nameCell);

      const balanceCell = document.createElement('td');
      balanceCell.textContent = user.balance;
      row.appendChild(balanceCell);

      const instrumentCell = document.createElement('td');
      instrumentCell.textContent = capitalizeFirstLetter(user.instrument);
      row.appendChild(instrumentCell);

      leaderboardBody.appendChild(row);
    });

    if (data.lastUpdated && data.lastUpdated._seconds) {
      const timestamp = new Date(data.lastUpdated._seconds * 1000);
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Denver'
      });
      const formattedTime = formatter.format(timestamp);
      lastUpdatedElement.textContent = `Last Updated: ${formattedTime}`;
      lastUpdatedElement.setAttribute(
        'title',
        `In your local time: ${timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })}`
      );
    } else {
      lastUpdatedElement.textContent = '';
      lastUpdatedElement.setAttribute('title', '');
    }

    if (filteredData.length > 0) {
      const firstRank = leaderboardBody.querySelector('tr:nth-child(1) .rank');
      const secondRank = leaderboardBody.querySelector('tr:nth-child(2) .rank');
      const thirdRank = leaderboardBody.querySelector('tr:nth-child(3) .rank');

      if (firstRank) firstRank.textContent = '🥇';
      if (secondRank) secondRank.textContent = '🥈';
      if (thirdRank) thirdRank.textContent = '🥉';
    }
  }

  function getCachedLeaderboard(period) {
    const cached = localStorage.getItem(`leaderboard_period_${period}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      if (now - parsed.timestamp < CACHE_DURATION) {
        return parsed.data;
      }
    }
    return null;
  }

  function setCachedLeaderboard(period, data) {
    const cacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(`leaderboard_period_${period}`, JSON.stringify(cacheEntry));
  }

  async function fetchLeaderboard(period) {
    showLoader();
    hideError();
    leaderboardBody.innerHTML = '';
    const cachedData = getCachedLeaderboard(period);
    if (cachedData) {
      populateLeaderboard(cachedData, period);
      hideLoader();
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch(`/api/getAggregatedLeaderboard?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch leaderboard data');
      }
      const data = await response.json();
      populateLeaderboard(data, period);
      setCachedLeaderboard(period, data);
    } catch (error) {
      showError(error.message || 'An unexpected error occurred.');
    } finally {
      hideLoader();
    }
  }

  async function handleTabClick(event) {
    const button = event.currentTarget;
    const period = button.dataset.period;
    periodButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    hideError();
    await fetchLeaderboard(period);
  }

  periodButtons.forEach(button => {
    button.addEventListener('click', handleTabClick);
  });

  async function initializeLeaderboard() {
    await window.auth0Promise;
    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
      window.location.href = '/pages/login.html';
      return;
    }
    const user = await getUser();
    const roles = (user && (user['https://mo-classroom.us/roles'] || user.roles)) || [];
    const isAdmin = roles.includes('admin');
    const periodButtonsContainer = document.getElementById('period-buttons');
    if (isAdmin) {
      periodButtonsContainer.classList.remove('hidden');
    }
    let defaultPeriod = 5;
    try {
      const token = await getToken();
      const response = await fetch('/api/getUserData', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        defaultPeriod = userData.class_period || 5;
      }
    } catch (error) {
        console.log("bro theres an error i think", error)
    }
    const defaultButton = document.querySelector(`.period-button[data-period="${defaultPeriod}"]`);
    if (defaultButton) {
      defaultButton.classList.add('active');
      await fetchLeaderboard(defaultPeriod);
    }
  }

  initializeLeaderboard();
});
