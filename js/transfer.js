async function loadTransferPage() {
  await window.auth0Promise;
  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) {
    window.location.href = '/pages/login.html';
    return;
  }
  try {
    let userData = getCachedUserData();
    if (!userData) {
      userData = await getUserData();
      setCachedUserData(userData);
    }
    document.getElementById('current-balance').textContent = `$${userData.currency_balance || 0}`;
    const classPeriod = userData.class_period;
    if (!classPeriod) {
      showToast('Error', 'User class period is undefined.');
      return;
    }
    setupTransferForm(classPeriod, userData.name);
    loadRecentTransactions(userData.transactions); // Use transactions from userData directly
  } catch (error) {
    showToast('Error', 'Failed to load user data.');
    console.error('Load Transfer Page Error:', error);
  }
}

document.addEventListener('DOMContentLoaded', loadTransferPage);

const CACHE_DURATION = 10 * 60 * 1000;

function getCachedUserData() {
  const cached = localStorage.getItem('userData');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      if (now - parsed.timestamp < CACHE_DURATION) {
        return parsed.data;
      }
    } catch (e) {
      console.error('Get Cached User Data Error:', e);
      return null;
    }
  }
  return null;
}

function setCachedUserData(data) {
  const cacheEntry = {
    data: data,
    timestamp: Date.now(),
  };
  localStorage.setItem('userData', JSON.stringify(cacheEntry));
}

async function getUserData() {
  const token = await getToken();
  const response = await fetch('/api/getUserData', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user data.');
  }
  return response.json();
}

async function getNamesForPeriod(period) {
  let names = getCachedNames(period);
  if (names) {
    return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }
  try {
    const token = await getToken();
    const response = await fetch(`/api/getAggregatedLeaderboard?period=${period}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (response.ok) {
      const extractedNames = (data.leaderboardData || []).map(item => item.name);
      setCachedNames(period, extractedNames);
      return extractedNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } else {
      showToast('Error', data.message || `Failed to load student names for period ${period}.`);
      return [];
    }
  } catch (error) {
    showToast('Error', `Failed to load student names for period ${period}.`);
    console.error('Get Names For Period Error:', error);
    return [];
  }
}

function setupTransferForm(period, senderName) {
  const recipientInput = document.getElementById('recipient-name');
  const amountInput = document.getElementById('transfer-amount');
  const transferForm = document.getElementById('transfer-form');
  const suggestionsContainer = recipientInput.nextElementSibling;
  let names = null;

  const loadNames = async () => {
    if (names) return;
    names = await getNamesForPeriod(period);
    names = names.filter((name) => name !== senderName);
  };

  recipientInput.addEventListener('focus', loadNames);

  recipientInput.addEventListener('input', () => {
    const query = recipientInput.value.trim().toLowerCase();
    suggestionsContainer.innerHTML = '';
    if (!query || !names) {
      return;
    }
    const matches = names.filter((name) => name.toLowerCase().includes(query));
    matches.forEach((name) => {
      const suggestion = document.createElement('div');
      suggestion.classList.add('suggestion-item');
      const highlightedName = name.replace(
        new RegExp(query, 'gi'),
        (match) => `<span class="highlighted">${match}</span>`
      );
      suggestion.innerHTML = highlightedName;
      suggestion.addEventListener('click', () => {
        recipientInput.value = name;
        suggestionsContainer.innerHTML = '';
      });
      suggestionsContainer.appendChild(suggestion);
    });
  });

  document.addEventListener('click', (e) => {
    if (!recipientInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.innerHTML = '';
    }
  });

  transferForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = transferForm.querySelector('button[type="submit"]');
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    const recipientName = recipientInput.value.trim();
    const amount = parseInt(amountInput.value, 10);
    if (!recipientName) {
      showToast('Validation Error', 'Please enter a valid recipient name.');
      submitButton.disabled = false;
      return;
    }
    if (recipientName.toLowerCase() === senderName.toLowerCase()) {
      showToast('Error', 'Why are you even trying to transfer to yourself smh');
      submitButton.disabled = false;
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Validation Error', 'Please enter a valid amount greater than zero.');
      submitButton.disabled = false;
      return;
    }
    try {
      const token = await getToken();
      const response = await fetch('/api/transferFunds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipientName,
          amount,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        showToast('Success', result.message);
        const updatedUserData = await getUserData();
        setCachedUserData(updatedUserData);
        document.getElementById('current-balance').textContent = `$${updatedUserData.currency_balance || 0}`;
        loadRecentTransactions(updatedUserData.transactions);
      } else {
        showToast('Error', result.message || 'An error occurred.');
      }
    } catch (error) {
      showToast('Network Error', 'Failed to process the request. Please try again later.');
      console.error('Transfer Form Submit Error:', error);
    }
    recipientInput.value = '';
    amountInput.value = '';
    suggestionsContainer.innerHTML = '';
    setTimeout(() => {
      submitButton.disabled = false;
    }, 2000);
  });
}

function loadRecentTransactions(transactions) {
  const list = document.getElementById('transactions');
  list.innerHTML = '';
  if (!transactions || transactions.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No transactions to show.';
    list.appendChild(li);
  } else {
    transactions.forEach(tx => {
      const li = document.createElement('li');
      const date = tx.timestamp ? new Date(tx.timestamp._seconds * 1000).toLocaleString() : '';
      li.textContent = `${tx.type === 'credit' ? '+' : '-'}$${tx.amount} ${tx.type === 'credit' ? 'from' : 'to'} ${tx.counterpart} on ${date}`;
      list.appendChild(li);
    });
  }
}
