async function loadTransferPage() {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const user = await getUser();
    document.getElementById('current-balance').textContent = `$${user.currency_balance || 0}`;
    // This will show transaction history but will be added later
}

document.addEventListener('DOMContentLoaded', loadTransferPage);
async function loadTransferPage() {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const user = await getUser();
    document.getElementById('current-balance').textContent = `$${user.currency_balance || 0}`;

    const classPeriod = user.class_period;
    setupTransferForm(classPeriod);
}

document.addEventListener('DOMContentLoaded', loadTransferPage);

function getCachedUserNames(period) {
    const cachedData = localStorage.getItem(`transferUserNames_period_${period}`);
    const timestamp = localStorage.getItem(`transferUserNamesTimestamp_period_${period}`);
    if (cachedData && timestamp) {
        const currentTime = Date.now();
        const cacheDuration = 2 * 60 * 1000;
        if (currentTime - parseInt(timestamp, 10) < cacheDuration) {
            return JSON.parse(cachedData);
        }
    }
    return null;
}

async function fetchUserNames(period) {
    let names = getCachedUserNames(period);
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
            const names = data.leaderboardData.map(user => user.name);
            localStorage.setItem(`transferUserNames_period_${period}`, JSON.stringify(names));
            localStorage.setItem(`transferUserNamesTimestamp_period_${period}`, Date.now().toString());
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
