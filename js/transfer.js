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
        setupTransferForm(classPeriod);
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

function setupTransferForm(period) {
    const recipientInput = document.getElementById('recipient-name');
    const suggestionsContainer = recipientInput.nextElementSibling;

    let aggregatedDataPromise = null;

    recipientInput.addEventListener('input', async () => {
        const query = recipientInput.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = '';

        if (!query) {
            return;
        }

        if (!aggregatedDataPromise) {
            aggregatedDataPromise = fetchAggregatedData(period);
        }

        const aggregatedData = await aggregatedDataPromise;
        if (!aggregatedData) {
            return;
        }

        const names = aggregatedData.leaderboardData.map(user => user.name).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const matches = names.filter(name => name.toLowerCase().includes(query));

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
    });

    document.addEventListener('click', (e) => {
        if (!recipientInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.innerHTML = '';
        }
    });
}
