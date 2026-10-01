async function loadTransferPage() {
  await window.auth0Promise;
  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) {
    window.location.href = 'login';
    return;
  }
  try {
    let userData = getCachedUserData();
    if (!userData) {
      userData = await getUserData();
      setCachedUserData(userData);
    }
    document.getElementById('current-balance').innerHTML = formatMoBucks(userData.currency_balance || 0);
    const classPeriod = userData.class_period;
    const validPeriods = (window.MOBANK_CLASS_PERIODS || []).map(period => period.value);
    if (!validPeriods.includes(Number(classPeriod))) {
      window.location.replace('/profile?welcome=1');
      return;
    }
    setupTransferForm();
    displayRecentTransactions(userData.transactions || []);
  } catch (error) {
    showToast('Error', 'Failed to load user data.');
  }
}

document.addEventListener('DOMContentLoaded', loadTransferPage);

function getCachedUserData() {
  return CACHE.read(CACHE.USER_KEY);
}

function setCachedUserData(data) {
  CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
}

async function getUserData() {
  // Check cache first
  const cachedData = CACHE.read(CACHE.USER_KEY);
  if (cachedData) {
    return cachedData;
  }

  // Wait for headerFooter.js userDataPromise
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!window.userDataPromise && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (window.userDataPromise) {
    try {
      const userData = await window.userDataPromise;
      if (userData) {
        return userData;
      }
    } catch (error) {
    }
  }
  
  // Fallback to direct API call if needed
  const token = await getToken();
  const response = await fetch('/api/getUserData', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user data.');
  }
  const userData = await response.json();
  CACHE.write(CACHE.USER_KEY, userData, CACHE.USER_MAX_AGE);
  return userData;
}

async function getTransferRecipients() {
  const token = await getToken();
  const response = await fetch('/api/getTransferRecipients', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Failed to load recipients.');
    error.status = response.status;
    throw error;
  }
  return Array.isArray(data.recipients) ? data.recipients : [];
}

function setupTransferForm() {
  const recipientInput = document.getElementById('recipient-name');
  const amountInput = document.getElementById('transfer-amount');
  const transferForm = document.getElementById('transfer-form');
  const suggestionsContainer = recipientInput.nextElementSibling;
  let recipients = null;
  let recipientsPromise = null;
  let selectedRecipient = null;

  const loadRecipients = async () => {
    if (recipients) return recipients;
    if (!recipientsPromise) {
      recipientsPromise = getTransferRecipients()
        .then(data => {
          recipients = data;
          return data;
        })
        .catch(error => {
          if (error.status === 428) {
            window.location.replace('/profile?welcome=1');
          }
          showToast('Error', error.message || 'Failed to load recipients.');
          recipientsPromise = null;
          return [];
        });
    }
    return recipientsPromise;
  };

  recipientInput.addEventListener('focus', loadRecipients);

  recipientInput.addEventListener('input', async () => {
    selectedRecipient = null;
    const query = recipientInput.value.trim().toLowerCase();
    suggestionsContainer.innerHTML = '';
    if (!query) {
      return;
    }
    const allRecipients = await loadRecipients();
    if (recipientInput.value.trim().toLowerCase() !== query) return;
    const matches = allRecipients.filter(user =>
      user.name.toLowerCase().includes(query)
    );
    matches.forEach(user => {
      const suggestion = document.createElement('div');
      suggestion.classList.add('suggestion-item');
      suggestion.textContent = user.name;
      suggestion.addEventListener('click', () => {
        recipientInput.value = user.name;
        selectedRecipient = user;
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
    const amount = amountInput.valueAsNumber;
    if (!selectedRecipient || selectedRecipient.name !== recipientInput.value.trim()) {
      showToast('Validation Error', 'Select a recipient from the suggestions.');
      submitButton.disabled = false;
      return;
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      showToast('Validation Error', 'Please enter a positive whole number.');
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
          recipientUid: selectedRecipient.uid,
          amount,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        showToast('Success', result.message);
        // The transfer response carries the sender data committed by the same
        // transaction, so the fresh balance cannot be shadowed by local cache.
        const updatedUserData = result.userData;
        setCachedUserData(updatedUserData);
        document.getElementById('current-balance').innerHTML = formatMoBucks(updatedUserData.currency_balance || 0);
        displayRecentTransactions(updatedUserData.transactions || []);
      } else {
        if (response.status === 428) {
          window.location.replace('/profile?welcome=1');
          return;
        }
        if (response.status === 409) {
          // The selected user may have changed periods after this list loaded.
          recipients = null;
          recipientsPromise = null;
        }
        showToast('Error', result.message || 'An error occurred.');
      }
    } catch (error) {
      showToast('Network Error', 'Failed to process the request. Please try again later.');
    }
    recipientInput.value = '';
    amountInput.value = '';
    selectedRecipient = null;
    suggestionsContainer.innerHTML = '';
    setTimeout(() => {
      submitButton.disabled = false;
    }, 2000);
  });
}

// Update the displayRecentTransactions function to match the dashboard styling
function displayRecentTransactions(transactions) {
  const list = document.getElementById('transactions');
  list.innerHTML = '';
  
  if (!transactions || transactions.length === 0) {
    const li = document.createElement('li');
    li.className = 'transaction-empty';
    li.textContent = 'No transactions to show.';
    list.appendChild(li);
    return;
  }

  transactions.forEach(tx => {
    const li = document.createElement('li');
    const seconds = tx.timestamp?._seconds ?? tx.timestamp?.seconds;
    const nanoseconds = tx.timestamp?._nanoseconds ?? tx.timestamp?.nanoseconds ?? 0;
    const date = Number.isFinite(seconds)
      ? new Date(seconds * 1000 + nanoseconds / 1000000)
      : new Date();
        
    const formattedDate = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const amountFormatted = formatMoBucks(tx.amount, { absolute: true });
    const amount = tx.type === 'credit' ? `+${amountFormatted}` : `-${amountFormatted}`;
    const amountClass = tx.type === 'credit' ? 'credit' : 'debit';

    const amountElement = document.createElement('span');
    amountElement.className = `transaction-amount ${amountClass}`;
    amountElement.textContent = amount;

    const details = document.createElement('span');
    details.className = 'transaction-details';
    const description = document.createElement('span');
    description.className = 'transaction-type';
    description.textContent = `${tx.type === 'credit' ? 'from' : 'to'} ${tx.counterpart || 'Unknown User'}`;
    const dateElement = document.createElement('span');
    dateElement.className = 'transaction-date';
    dateElement.textContent = formattedDate;
    details.append(description, dateElement);
    li.append(amountElement, details);
    list.appendChild(li);
  });
}
