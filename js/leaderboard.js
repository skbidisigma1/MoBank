document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const periodButtons = document.querySelectorAll('.period-button');
  const leaderboardBody = document.getElementById('leaderboard-body');
  const leaderboardCards = document.getElementById('leaderboard-cards');
  const lastUpdatedElement = document.getElementById('last-updated');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const leaderboardTitle = document.getElementById('leaderboard-title');

  // Keep 30 seconds for leaderboard cache since it's more frequently updated
  const LEADERBOARD_CACHE_DURATION = 30 * 1000;
  // Bump this namespace when changing how leaderboard data is sourced so
  // localStorage snapshots from the previous school-year flow are ignored.
  const LEADERBOARD_CACHE_PREFIX = 'leaderboard_v2_period_';
  const classPeriods = Array.isArray(window.MOBANK_CLASS_PERIODS)
    ? window.MOBANK_CLASS_PERIODS
    : [];

  function getPeriodDefinition(period) {
    return classPeriods.find(item => Number(item.value) === Number(period));
  }

  function getPeriodLabel(period, short = false) {
    const definition = getPeriodDefinition(period);
    if (!definition) return `Period ${period}`;
    return short ? definition.shortLabel : definition.label;
  }

  function capitalizeFirstLetter(string) {
    if (typeof string !== 'string' || !string) return 'N/A';
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
  function appendInstrumentDisplay(container, user, isGlobal) {
    container.appendChild(document.createTextNode(capitalizeFirstLetter(user.instrument)));
    if (!isGlobal || !user.class_period) return;

    const periodTag = document.createElement('span');
    periodTag.className = 'period-tag';
    periodTag.textContent = getPeriodLabel(user.class_period, true);
    container.appendChild(periodTag);
  }

  function createCard(user, index, isGlobal = false) {
    const rank = index + 1;
    const card = document.createElement('div');
    card.className = 'leaderboard-card';

    const rankDisplay = rank <= 3 ? 
      (rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉') : 
      `#${rank}`;
      
    const rankElement = document.createElement('div');
    rankElement.className = `card-rank ${rank <= 3 ? `rank-${rank}` : ''}`.trim();
    rankElement.textContent = rankDisplay;

    const nameElement = document.createElement('div');
    nameElement.className = 'card-name';
    nameElement.textContent = user.name || 'Unknown User';

    const divider = document.createElement('div');
    divider.className = 'card-divider';

    const balanceElement = document.createElement('div');
    balanceElement.className = 'card-balance';
    balanceElement.innerHTML = formatMoBucks(user.balance, { absolute: true });

    const instrumentElement = document.createElement('div');
    instrumentElement.className = 'card-instrument';
    appendInstrumentDisplay(instrumentElement, user, isGlobal);

    card.append(rankElement, nameElement, divider, balanceElement, instrumentElement);

    return card;
  }

  function populateLeaderboard(data, period) {
    leaderboardBody.innerHTML = '';
    leaderboardCards.innerHTML = '';
    
    const periodLabel = period === 'global' ? 'Global' : getPeriodLabel(period);
    leaderboardTitle.querySelector('span').textContent = `Leaderboard - ${periodLabel}`;
    
    const leaderboardData = Array.isArray(data.leaderboardData) ? data.leaderboardData : [];
    leaderboardData.forEach((user, index) => {
      const row = document.createElement('tr');
      const rank = index + 1;

      const rankCell = document.createElement('td');
      rankCell.className = 'rank-cell';
      if (rank <= 3) {
        rankCell.classList.add(`rank-${rank}`);
        rankCell.innerHTML = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
      } else {
        rankCell.textContent = `#${rank}`;
      }
      row.appendChild(rankCell);

      const nameCell = document.createElement('td');
      nameCell.className = 'name-cell';
      nameCell.textContent = user.name || 'Unknown User';
      row.appendChild(nameCell);

      const balanceCell = document.createElement('td');
      balanceCell.className = 'balance-cell';
      balanceCell.innerHTML = formatMoBucks(user.balance, { absolute: true });
      row.appendChild(balanceCell);

      const instrumentCell = document.createElement('td');
      instrumentCell.className = 'instrument-cell';
      
      // for global leaderboard, show both instrument and period
      appendInstrumentDisplay(instrumentCell, user, period === 'global');
      
      row.appendChild(instrumentCell);

      leaderboardBody.appendChild(row);
    });
    leaderboardData.forEach((user, index) => {
      const card = createCard(user, index, period === 'global');
      leaderboardCards.appendChild(card);
    });

    if (leaderboardData.length === 0) {
      const message = period === 'global'
        ? 'No users are assigned to any period yet.'
        : `No users are assigned to ${getPeriodLabel(period)} yet.`;
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      emptyCell.textContent = message;
      emptyRow.appendChild(emptyCell);
      leaderboardBody.appendChild(emptyRow);

      const emptyCardMessage = document.createElement('div');
      emptyCardMessage.className = 'leaderboard-empty';
      emptyCardMessage.textContent = message;
      leaderboardCards.appendChild(emptyCardMessage);
    }

    const updatedSeconds = data.lastUpdated?._seconds ?? data.lastUpdated?.seconds;
    if (Number.isFinite(updatedSeconds)) {
      const timestamp = new Date(updatedSeconds * 1000);
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
    try {
      const cached = localStorage.getItem(`${LEADERBOARD_CACHE_PREFIX}${period}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - Number(parsed.timestamp);
        if (parsed.data && Number.isFinite(age) && age >= 0 && age < LEADERBOARD_CACHE_DURATION) {
          return parsed.data;
        }
      }
    } catch (error) {
      try {
        localStorage.removeItem(`${LEADERBOARD_CACHE_PREFIX}${period}`);
      } catch (storageError) {
        // The page can still fetch fresh data when browser storage is unavailable.
      }
    }
    return null;
  }

  function setCachedLeaderboard(period, data) {
    const cacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(`${LEADERBOARD_CACHE_PREFIX}${period}`, JSON.stringify(cacheEntry));
    } catch (error) {
      // Caching is optional; keep the freshly fetched leaderboard visible.
    }
  }
  async function fetchLeaderboard(period) {
    showLoader();
    hideError();
    leaderboardBody.innerHTML = '';
    
    if (period === 'global') {
      await fetchGlobalLeaderboard();
      return;
    }
    
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
  
  async function fetchGlobalLeaderboard() {
    const cachedGlobal = getCachedLeaderboard('global');
    if (cachedGlobal) {
      populateLeaderboard(cachedGlobal, 'global');
      hideLoader();
      return;
    }

    try {
      const token = await getToken();
      const validPeriods = classPeriods.map(item => item.value);
      const leaderboardPromises = validPeriods.map(period => 
        fetch(`/api/getAggregatedLeaderboard?period=${period}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).then(async response => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch global leaderboard data.');
          }
          return response.json();
        })
      );
      const results = await Promise.all(leaderboardPromises);
      
      let combinedData = [];
      results.forEach((result, index) => {
        if (result.leaderboardData && result.leaderboardData.length > 0) {
          // Add the period information to each user
          const period = validPeriods[index];
          const dataWithPeriod = result.leaderboardData.map(user => ({
            ...user,
            class_period: period
          }));
          combinedData = combinedData.concat(dataWithPeriod);
        }
      });
      
      const globalLeaderboardData = combinedData.sort((a, b) => b.balance - a.balance);
      
      const globalData = {
        leaderboardData: globalLeaderboardData,
        lastUpdated: { _seconds: Math.floor(Date.now() / 1000) }
      };
      
      populateLeaderboard(globalData, 'global');
      setCachedLeaderboard('global', globalData);
    } catch (error) {
      showError(error.message || 'Failed to fetch global leaderboard data.');
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
    // Show period selector for all authenticated users
    const periodButtonsContainer = document.getElementById('period-buttons');
    if (periodButtonsContainer) {
      periodButtonsContainer.classList.remove('hidden');
    }
    
    let defaultPeriod = getPeriodDefinition(5)?.value ?? classPeriods[0]?.value ?? 5;
    
    // Check cache first for user data
    const cachedUserData = CACHE.read(CACHE.USER_KEY);
    if (cachedUserData && getPeriodDefinition(cachedUserData.class_period)) {
      defaultPeriod = Number(cachedUserData.class_period);
    } else {
      // Wait for headerFooter.js to set up userDataPromise
      let attempts = 0;
      const maxAttempts = 10; // Wait up to 1 second
      
      while (!window.userDataPromise && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (window.userDataPromise) {
        try {
          const userData = await window.userDataPromise;
          if (userData && getPeriodDefinition(userData.class_period)) {
            defaultPeriod = Number(userData.class_period);
          }
        } catch (error) {
        }
      }
    }
    
    const defaultButton = document.querySelector(`.period-button[data-period="${defaultPeriod}"]`);
    if (defaultButton) {
      defaultButton.classList.add('active');
      await fetchLeaderboard(defaultPeriod);
    }
  }

  await initializeLeaderboard();
});
