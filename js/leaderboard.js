document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const periodButtons = document.querySelectorAll('.period-button');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const leaderboardCards = document.getElementById('leaderboard-cards');
  const lastUpdatedElement = document.getElementById('last-updated');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const leaderboardTitle = document.getElementById('leaderboard-title');

  const CACHE_DURATION = 60 * 1000; // 1 minute cache

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

  function createCard(user, index) {
    const rank = index + 1;
    const card = document.createElement('div');
    card.className = 'leaderboard-card';

    const rankDisplay = rank <= 3 ? 
      (rank === 1 ? '🏆' : rank === 2 ? '🥈' : '🥉') : 
      `#${rank}`;

    card.innerHTML = `
      <div class="card-rank ${rank <= 3 ? `rank-${rank}` : ''}">${rankDisplay}</div>
      <div class="card-name">${user.name === 'Luke Collingridge' ? '🛠️ ' + user.name : user.name}</div>
      <div class="card-divider"></div>
      <div class="card-balance">${user.balance} MoBucks</div>
      <div class="card-instrument">${capitalizeFirstLetter(user.instrument)}</div>
    `;

    return card;
  }

  function populateLeaderboard(data, period) {
    leaderboardBody.innerHTML = '';
    leaderboardCards.innerHTML = '';
    leaderboardTitle.querySelector('span').textContent = `Leaderboard - Period ${period}`;
    
    const filteredData = data.leaderboardData.filter(
      user => user.name !== 'Madison Moline'
    );

    // Populate table view
    filteredData.forEach((user, index) => {
      const row = document.createElement('tr');
      const rank = index + 1;

      const rankCell = document.createElement('td');
      rankCell.className = 'rank-cell';
      if (rank <= 3) {
        rankCell.classList.add(`rank-${rank}`);
        rankCell.innerHTML = rank === 1 ? '🏆' : rank === 2 ? '🥈' : '🥉';
      } else {
        rankCell.textContent = `#${rank}`;
      }
      row.appendChild(rankCell);

      const nameCell = document.createElement('td');
      nameCell.className = 'name-cell';
      nameCell.textContent = user.name;
      if (user.name === 'Luke Collingridge') {
        nameCell.innerHTML = '🛠️ ' + user.name;
      }
      row.appendChild(nameCell);

      const balanceCell = document.createElement('td');
      balanceCell.className = 'balance-cell';
      balanceCell.textContent = user.balance;
      row.appendChild(balanceCell);

      const instrumentCell = document.createElement('td');
      instrumentCell.className = 'instrument-cell';
      instrumentCell.textContent = capitalizeFirstLetter(user.instrument);
      row.appendChild(instrumentCell);

      leaderboardBody.appendChild(row);
    });

    // Populate card view
    filteredData.forEach((user, index) => {
      const card = createCard(user, index);
      leaderboardCards.appendChild(card);
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
      window.location.href = 'login';
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

  await initializeLeaderboard();
});
