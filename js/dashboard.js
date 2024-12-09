document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    try {
        await window.auth0Promise;

        await fetchUserData();
        await setProfileImage();
    } catch (error) {
        console.error('Error during dashboard initialization:', error);
        showToast('Error', 'Failed to initialize dashboard. Please try again later.');
    } finally {
        loader.classList.add('hidden');
    }
});

const USER_DATA_COOLDOWN_MILLISECONDS = 20 * 1000;
const TOKEN_COOLDOWN_MILLISECONDS = 5 * 60 * 1000;
let cachedToken = null;
let tokenTimestamp = 0;

async function fetchUserData() {
    try {
        const cachedUserData = getCachedUserData();
        if (cachedUserData) {
            console.log('Using cached user data:', cachedUserData);
            validateUserData(cachedUserData);
            populateDashboard(cachedUserData);
            return;
        }

        const token = await getCachedToken();

        const response = await fetch('/api/getUserData', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
            const userData = await response.json();
            console.log('Fetched user data:', userData);
            validateUserData(userData);
            setCachedUserData(userData);
            populateDashboard(userData);
        } else if (response.status === 404) {
            redirectTo('/pages/profile.html');
        } else {
            throw new Error('Failed to fetch user data');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        showToast('Error', 'Failed to fetch user data. Please try again later.');
        redirectTo('/pages/profile.html');
    }
}

async function getCachedToken() {
    if (!cachedToken || Date.now() - tokenTimestamp > TOKEN_COOLDOWN_MILLISECONDS) {
        try {
            cachedToken = await auth0Client.getTokenSilently();
            tokenTimestamp = Date.now();
            console.log('Fetched new token');
        } catch (error) {
            console.error('Error fetching token:', error);
            signInWithAuth0();
        }
    } else {
        console.log('Using cached token');
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
    const validInstruments = ['violin', 'viola', 'cello', 'bass'];
    const validClassPeriods = [5, 6, 7];
    if (!validInstruments.includes(userData.instrument.toLowerCase()) || !validClassPeriods.includes(userData.class_period)) {
        redirectTo('/pages/profile.html');
    }
}

function populateDashboard(userData) {
    const name = userData.name || 'User';
    const currency_balance = userData.currency_balance || 0;
    const instrument = capitalizeFirstLetter(userData.instrument || 'N/A');

    const profileName = document.getElementById('profile-name');
    const profileCurrency = document.getElementById('profile-currency');
    const dashboardContent = document.getElementById('dashboard-content');

    profileName.textContent = `Welcome, ${name}!`;
    profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;

    dashboardContent.innerHTML = `
        <div class="dashboard-card"><strong>Class Period:</strong> ${userData.class_period || 'N/A'}</div>
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
