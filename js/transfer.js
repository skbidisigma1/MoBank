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
        setupTransferForm(userData);
    } catch (error) {
        showToast('Error', 'Failed to load user data.');
        console.error(error);
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
            console.error('Failed to parse cached userData:', e);
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

function getCachedAggregatedData(period) {
    const cached = localStorage.getItem(`aggregatedByPeriod-${period}`);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            const now = Date.now();
            if (now - parsed.timestamp < CACHE_DURATION) {
                return parsed.data;
            }
        } catch (e) {
            console.error(`Failed to parse cached aggregated data for period ${period}:`, e);
            return null;
        }
    }
    return null;
}

function setCachedAggregatedData(period, data) {
    const cacheEntry = {
        data: data,
        timestamp: Date.now(),
    };
    localStorage.setItem(`aggregatedByPeriod-${period}`, JSON.stringify(cacheEntry));
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

async function fetchAggregatedData(period) {
    let aggregatedData = getCachedAggregatedData(period);
    if (aggregatedData) {
        return aggregatedData;
    }
    try {
        const token = await getToken();
        const response = await fetch(`/api/getAggregatedLeaderboard?period=${period}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            const errorData = await response.json();
            showToast('Error', errorData.message || 'Failed to load aggregated data.');
            return null;
        }
        const data = await response.json();
        setCachedAggregatedData(period, data);
        return data;
    } catch (error) {
        showToast('Error', 'Failed to load aggregated data.');
        console.error(error);
        return null;
    }
}

async function fetchAllUserNames() {
    try {
        const token = await getToken();
        const response = await fetch('/api/getAllUserNames', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            const errorData = await response.json();
            showToast('Error', errorData.message || 'Failed to load user names.');
            return [];
        }
        const data = await response.json();
        return data.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } catch (error) {
        showToast('Error', 'Failed to load user names.');
        console.error(error);
        return [];
    }
}

function setupTransferForm(userData) {
    const recipientInput = document.getElementById('recipient-name');
    const suggestionsContainer = recipientInput.nextElementSibling;
    let allUserNames = null;

    const loadAllUserNames = async () => {
        if (allUserNames) return;
        allUserNames = await fetchAllUserNames();
    };

    recipientInput.addEventListener('focus', loadAllUserNames);

    recipientInput.addEventListener('input', () => {
        const query = recipientInput.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = '';

        if (!query || !allUserNames) {
            return;
        }

        const matches = allUserNames.filter(name => name.toLowerCase().includes(query));

        matches.forEach(name => {
            const suggestion = document.createElement('div');
            suggestion.classList.add('suggestion-item');

            const highlightedName = name.replace(
                new RegExp(query, 'gi'),
                match => `<span class="highlighted">${match}</span>`
            );
            suggestion.innerHTML = highlightedName;

            suggestion.addEventListener('click', () => {
                recipientInput.value = name;
                suggestionsContainer.innerHTML = '';
            });
            suggestionsContainer.appendChild(suggestion);
        });

        if (matches.length === 0) {
            const noMatch = document.createElement('div');
            noMatch.classList.add('suggestion-item');
            noMatch.textContent = 'No matches found';
            suggestionsContainer.appendChild(noMatch);
        }
    });

    document.addEventListener('click', (e) => {
        if (!recipientInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.innerHTML = '';
        }
    });

    const transferForm = document.getElementById('transfer-form');
    transferForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitButton = transferForm.querySelector('button[type="submit"]');
        if (submitButton.disabled) return;
        submitButton.disabled = true;

        const amountInput = document.getElementById('transfer-amount');
        const recipientName = recipientInput.value.trim();
        const amount = parseInt(amountInput.value, 10);

        if (!recipientName) {
            showToast('Validation Error', 'Please enter a valid recipient name.');
            submitButton.disabled = false;
            return;
        }

        if (!amount || amount <= 0) {
            showToast('Validation Error', 'Please enter a valid amount greater than zero.');
            submitButton.disabled = false;
            return;
        }

        if (recipientName === userData.name) {
            showToast('Validation Error', 'You cannot transfer to yourself.');
            submitButton.disabled = false;
            return;
        }

        if (amount > userData.currency_balance) {
            showToast('Validation Error', 'Insufficient balance.');
            submitButton.disabled = false;
            return;
        }

        try {
            const token = await getToken();

            const response = await fetch('/api/transferCurrency', {
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
                userData.currency_balance -= amount;
                setCachedUserData(userData);
                document.getElementById('current-balance').textContent = `$${userData.currency_balance || 0}`;
            } else {
                showToast('Error', result.message || 'An error occurred.');
            }
        } catch (error) {
            showToast('Network Error', 'Failed to process the request. Please try again later.');
        }

        recipientInput.value = '';
        amountInput.value = '';
        suggestionsContainer.innerHTML = '';
        setTimeout(() => {
            submitButton.disabled = false;
        }, 2000);
    });
}
