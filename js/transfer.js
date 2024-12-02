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

const namesCache = {};
const CACHE_DURATION = 10 * 60 * 1000;

function getCachedUserData() {
    const cached = localStorage.getItem('userData');
    if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_DURATION) {
            return parsed.data;
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

function getCachedNames(period) {
    const cached = localStorage.getItem(`namesByPeriod-${period}`);
    if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_DURATION) {
            return parsed.data;
        }
    }
    return null;
}

function setCachedNames(period, data) {
    const cacheEntry = {
        data: data,
        timestamp: Date.now(),
    };
    localStorage.setItem(`namesByPeriod-${period}`, JSON.stringify(cacheEntry));
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

async function fetchUserNames(period) {
    if (namesCache[period]) {
        return namesCache[period];
    }
    let names = getCachedNames(period);
    if (names) {
        namesCache[period] = names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return namesCache[period];
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
            const names = data.leaderboardData.map(user => user.name);
            namesCache[period] = names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            setCachedNames(period, namesCache[period]);
            return namesCache[period];
        } else {
            showToast('Error', data.message || 'Failed to load user names.');
            return [];
        }
    } catch (error) {
        showToast('Error', 'Failed to load user names.');
        console.error(error);
        return [];
    }
}

function setupTransferForm(period) {
    const recipientInput = document.getElementById('recipient-name');
    const suggestionsContainer = recipientInput.nextElementSibling;

    recipientInput.addEventListener('input', async () => {
        const query = recipientInput.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = '';

        if (!query) {
            return;
        }

        const names = await fetchUserNames(period);
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
