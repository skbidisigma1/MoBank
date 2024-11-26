document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    await window.auth0Promise;

    const dashboardContent = document.getElementById('dashboard-content');
    const profileName = document.getElementById('profile-name');
    const profileCurrency = document.getElementById('profile-currency');
    const profileImage = document.querySelector('.dashboard-profile-icon');
    const transferButton = document.getElementById('transfer-mobucks-btn');
    const logoutButton = document.getElementById('logout-btn');

    const placeholderPath = '/images/default_profile.svg';
    const TOKEN_COOLDOWN_MILLISECONDS = 5 * 60 * 1000;
    const USER_DATA_COOLDOWN_MILLISECONDS = 2 * 60 * 1000;
    let cachedToken = null;
    let tokenTimestamp = 0;

    if (transferButton) {
        transferButton.addEventListener('click', () => {
            window.location.href = '/pages/transfer.html';
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            localStorage.clear();
            await logoutUser();
            window.location.href = '/pages/login.html';
        });
    }

    async function getCachedToken() {
        if (!cachedToken || Date.now() - tokenTimestamp > TOKEN_COOLDOWN_MILLISECONDS) {
            try {
                cachedToken = await auth0Client.getTokenSilently();
                tokenTimestamp = Date.now();
            } catch (error) {
                console.error('Error fetching token:', error);
                signInWithAuth0();
            }
        }
        return cachedToken;
    }

    async function fetchUserData() {
        try {
            const lastFetchTimestamp = parseInt(localStorage.getItem('userDataTimestamp'), 10) || 0;
            if (Date.now() - lastFetchTimestamp < USER_DATA_COOLDOWN_MILLISECONDS) {
                const cachedUserData = JSON.parse(localStorage.getItem('userData')) || {};
                populateDashboard(cachedUserData);
                loader.classList.add('hidden');
                return;
            }

            const token = await getCachedToken();

            const response = await fetch('/api/getUserData', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const userData = await response.json();

                localStorage.setItem('userData', JSON.stringify(userData));
                localStorage.setItem('userDataTimestamp', Date.now().toString());

                if (userData.picture) {
                    profileImage.src = userData.picture;
                } else {
                    profileImage.src = placeholderPath;
                }

                populateDashboard(userData);

                loader.classList.add('hidden');
            } else if (response.status === 404) {
                window.location.href = '/pages/profile.html';
            } else {
                throw new Error('Failed to fetch user data');
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            window.location.href = '/pages/profile.html';
        }
    }

    function populateDashboard(userData) {
        const name = userData.name || 'User';
        const currency_balance = userData.currency_balance || 0;
        const instrument = capitalizeFirstLetter(userData.instrument || 'N/A');
        const email = userData.privateData.email || 'N/A';

        profileName.textContent = `Welcome, ${name}!`;
        profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;

        dashboardContent.innerHTML = `
            <div class="dashboard-card"><strong>Email:</strong> ${email}</div>
            <div class="dashboard-card"><strong>Class Period:</strong> ${userData.class_period || 'N/A'}</div>
            <div class="dashboard-card"><strong>Instrument:</strong> ${instrument}</div>
        `;
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    await fetchUserData();
});