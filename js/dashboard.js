document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');

    try {
        await window.auth0Promise;

        const dashboardContent = document.getElementById('dashboard-content');
        const profileName = document.getElementById('profile-name');
        const profileCurrency = document.getElementById('profile-currency');
        const profileImage = document.querySelector('.dashboard-profile-icon');
        const transferButton = document.getElementById('transfer-mobucks-btn');
        const logoutButton = document.getElementById('logout-btn');
        const profileButton = document.getElementById('profile-btn');

        const placeholderPath = '/images/default_profile.svg';
        const TOKEN_COOLDOWN_MILLISECONDS = 5 * 60 * 1000;
        const USER_DATA_COOLDOWN_MILLISECONDS = 20 * 1000;
        let cachedToken = null;
        let tokenTimestamp = 0;

        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    await window.logoutUser();
                    localStorage.clear();
                    window.location.href = '/pages/login.html';
                } catch (error) {
                    console.error('Error during logout:', error);
                    alert('Failed to log out. Please try again.');
                }
            });
        }

        if (transferButton) {
            transferButton.addEventListener('click', () => {
                window.location.href = '/pages/transfer.html';
            });
        }

        if (profileButton) {
            profileButton.addEventListener('click', () => {
                window.location.href = '/pages/profile.html';
            });
        }

        function getCachedUserData() {
            const cached = localStorage.getItem('userData');
            if (cached) {
                const parsed = JSON.parse(cached);
                const now = Date.now();
                if (now - parsed.timestamp < USER_DATA_COOLDOWN_MILLISECONDS) {
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

        async function getCachedToken() {
            if (!cachedToken || Date.now() - tokenTimestamp > TOKEN_COOLDOWN_MILLISECONDS) {
                try {
                    cachedToken = await window.auth0Client.getTokenSilently();
                    tokenTimestamp = Date.now();
                } catch (error) {
                    console.error('Error fetching token:', error);
                    window.signInWithAuth0();
                }
            }
            return cachedToken;
        }

        async function fetchUserData() {
            try {
                const cachedUserData = getCachedUserData();
                if (cachedUserData) {
                    validateUserData(cachedUserData);
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
                    validateUserData(userData);
                    setCachedUserData(userData);
                    populateDashboard(userData);
                } else if (response.status === 404) {
                    window.location.href = '/pages/profile.html';
                } else {
                    throw new Error('Failed to fetch user data');
                }
            } catch (error) {
                showToast('Error', 'Failed to fetch user data. Please try again later.');
                console.error('Error fetching user data:', error);
                window.location.href = '/pages/profile.html';
            } finally {
                loader.classList.add('hidden');
            }
        }

        function validateUserData(userData) {
            const validInstruments = ['violin', 'viola', 'cello', 'bass'];
            const validClassPeriods = [5, 6, 7];
            if (!validInstruments.includes(userData.instrument.toLowerCase()) || !validClassPeriods.includes(userData.class_period)) {
                window.location.href = '/pages/profile.html';
            }
        }

        function populateDashboard(userData) {
            const name = userData.name || 'User';
            const currency_balance = userData.currency_balance || 0;
            const instrument = capitalizeFirstLetter(userData.instrument || 'N/A');

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
            try {
                const user = await window.auth0Client.getUser();
                if (user && user.picture) {
                    profileImage.src = user.picture;
                } else {
                    profileImage.src = placeholderPath;
                }
            } catch (error) {
                console.error('Error fetching Auth0 user:', error);
                profileImage.src = placeholderPath;
            }
        }

        const profileSuccessful = getUrlParameter('profile_successful');
        if (profileSuccessful) {
            showToast('Success', 'Profile updated successfully!');
        }

        function getUrlParameter(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        }

        await Promise.all([fetchUserData(), setProfileImage()]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        alert('An error occurred while loading the dashboard. Please refresh the page.');
    } finally {
        loader.classList.add('hidden');
    }
});
