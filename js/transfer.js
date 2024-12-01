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

function getCachedUserData() {
    const cachedData = localStorage.getItem('userData');
    const timestamp = localStorage.getItem('userDataTimestamp');
    if (cachedData && timestamp) {
        const currentTime = Date.now();
        const cacheDuration = 20 * 1000;
        if (currentTime - parseInt(timestamp, 10) < cacheDuration) {
            return JSON.parse(cachedData);
        }
    }
    return null;
}

function setCachedUserData(data) {
    localStorage.setItem('userData', JSON.stringify(data));
    localStorage.setItem('userDataTimestamp', Date.now().toString());
}

async function fetchUserNames(period) {
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
            return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
