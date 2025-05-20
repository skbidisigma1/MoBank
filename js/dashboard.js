document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    const error = getUrlParameter('error');
    const errorDescription = getUrlParameter('error_description');
    if (error && errorDescription) {
        const loginUrl = `login?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription)}`;
        window.location.replace(loginUrl);
        return;
    }

    try {
        await window.auth0Promise;

        await fetchUserData();
        await setProfileImage();

        setupButtons();

        const profileSuccessful = getUrlParameter('profile_successful');
        if (profileSuccessful === 'true') {
            showToast('Success', 'Profile updated successfully!');
        }
        
    } catch (error) {
        console.error('Error during dashboard initialization:', error);
        showToast('Error', 'Failed to initialize dashboard. Please try again later.');
    } finally {
        // Ensure the loader is hidden
        loader.style.display = 'none';
        loader.classList.add('hidden');
    }
});

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function setupButtons() {
    const transferButton = document.getElementById('transfer-mobucks-btn');
    const moToolsButton = document.getElementById('motools-btn');
    const logoutButton = document.getElementById('logout-btn');
    const profileButton = document.getElementById('profile-btn');
    const leaderboardButton = document.getElementById('leaderboard-btn');

    if (moToolsButton) {
        moToolsButton.addEventListener('click', () => {
            window.location.href = 'tools';
        });
    }

    if (transferButton) {
        transferButton.addEventListener('click', () => {
            window.location.href = 'transfer';
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            await logoutUser();
            window.location.href = 'login';
        });
    }

    if (profileButton) {
        profileButton.addEventListener('click', () => {
            window.location.href = 'profile';
        });
    }
    
    if (leaderboardButton) {
        leaderboardButton.addEventListener('click', () => {
            window.location.href = 'leaderboard';
        });
    }
}

const USER_DATA_COOLDOWN_MILLISECONDS = 20 * 1000;
const TOKEN_COOLDOWN_MILLISECONDS = 5 * 60 * 1000;
let cachedToken = null;
let tokenTimestamp = 0;

async function fetchUserData() {
    try {
        const cachedUserData = getCachedUserData();
        if (cachedUserData) {
            validateUserData(cachedUserData);
            populateDashboard(cachedUserData);
            displayTransactionHistory(cachedUserData.transactions || []);
            return;
        }

        const token = await getCachedToken();

        const response = await fetch('/api/getUserData', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
            const userData = await response.json();
            validateUserData(userData);
            setCachedUserData(userData);
            populateDashboard(userData);
            displayTransactionHistory(userData.transactions || []);
        } else if (response.status === 404) {
            redirectTo('profile');
        } else {
            throw new Error('Failed to fetch user data');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('Error', 'Failed to fetch user data. Please try again later.');
        redirectTo('profile');
    }
}

async function getCachedToken() {
    if (!cachedToken || Date.now() - tokenTimestamp > TOKEN_COOLDOWN_MILLISECONDS) {
        try {
            cachedToken = await auth0Client.getTokenSilently();
            tokenTimestamp = Date.now();
        } catch (error) {
            console.error('Error fetching token:', error);
            await signInWithAuth0();
        }
    }
    return cachedToken;
}

function getCachedUserData() {
    const cached = localStorage.getItem('userData');
    if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < USER_DATA_COOLDOWN_MILLISECONDS) {
            return parsed.data;
        }
    }
    return null;
}

function setCachedUserData(data) {
    localStorage.setItem('userData', JSON.stringify({ data, timestamp: Date.now() }));
}

function validateUserData(userData) {
    const validInstruments = ['violin', 'viola', 'cello', 'bass', 'other'];
    const validClassPeriods = [5, 6, 7, 8, 9, 10];
    const validThemes = ['light', 'dark'];
    if (
        !validInstruments.includes(userData.instrument.toLowerCase()) ||
        !validClassPeriods.includes(userData.class_period) ||
        !validThemes.includes(userData.theme)
    ) {
        redirectTo('profile');
    }
}

const periodNames = {
    '5': 'Period 5',
    '6': 'Period 6',
    '7': 'Period 7',
    '8': 'Symphonic Orchestra',
    '9': 'Full Orchestra',
    '10': 'Chamber Orchestra'
};

function populateDashboard(userData) {
    const name = userData.name || 'User';
    const currency_balance = userData.currency_balance || 0;
    const instrument = capitalizeFirstLetter(userData.instrument || 'N/A');

    const profileName = document.getElementById('profile-name');
    const profileCurrency = document.getElementById('profile-currency');
    const dashboardContent = document.getElementById('dashboard-content');

    profileName.textContent = `Welcome, ${name}!`;

    let formattedBalance;
    if (currency_balance < 0) {
        formattedBalance = `-$${Math.abs(currency_balance)}`;
    } else {
        formattedBalance = `$${currency_balance}`;
    }

    profileCurrency.innerHTML = `MoBuck Balance: <span id="currency-value">${formattedBalance}</span>`;

    const currencyValueSpan = document.getElementById('currency-value');
    if (currency_balance < 0) {
        currencyValueSpan.style.color = 'rgb(220, 53, 69)';
    } else {
        currencyValueSpan.style.color = '';
    }

    const periodName = periodNames[userData.class_period] || `Period ${userData.class_period}`;

    dashboardContent.innerHTML = `
        <div class="dashboard-card"><strong>Class Period:</strong> ${periodName}</div>
        <div class="dashboard-card"><strong>Instrument:</strong> ${instrument}</div>
    `;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

async function setProfileImage() {
    const profileImage = document.querySelector('.dashboard-profile-icon');
    const placeholderPath = '/images/default_profile.svg';

    try {
        const user = await auth0Client.getUser();
        if (user && user.picture) {
            profileImage.src = user.picture;
        } else {
            profileImage.src = placeholderPath;
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
        profileImage.src = placeholderPath;
        showToast('Warning', 'Unable to load your profile picture.');
    }
}

function redirectTo(url) {
    window.location.href = url;
}

function displayTransactionHistory(transactions) {
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
        const date = tx.timestamp 
            ? new Date(tx.timestamp._seconds * 1000 + (tx.timestamp._nanoseconds || 0) / 1000000)
            : new Date();
            
        const formattedDate = date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const amount = tx.type === 'credit' ? `+$${tx.amount}` : `-$${tx.amount}`;
        const amountClass = tx.type === 'credit' ? 'credit' : 'debit';
        
        li.innerHTML = `
            <span class="transaction-amount ${amountClass}">${amount}</span>
            <span class="transaction-details">
                <span class="transaction-type">${tx.type === 'credit' ? 'from' : 'to'} ${tx.counterpart}</span>
                <span class="transaction-date">${formattedDate}</span>
            </span>
        `;
        list.appendChild(li);
    });
}
