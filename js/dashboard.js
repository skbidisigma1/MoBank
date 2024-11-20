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
    const cacheExpiry = 20000;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        loader.classList.add('hidden');
        window.location.href = '/pages/login.html';
        return;
    }

    if (transferButton) {
        transferButton.addEventListener('click', () => {
            window.location.href = '/pages/transfer.html';
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            sessionStorage.clear();
            await logoutUser();
            window.location.href = '/pages/login.html';
        });
    }

    try {
        let userData = JSON.parse(sessionStorage.getItem('userData'));
        const cachedTimestamp = parseInt(sessionStorage.getItem('userDataTimestamp'), 10);
        const now = Date.now();

        if (!userData || !cachedTimestamp || (now - cachedTimestamp) > cacheExpiry) {
            const token = await getToken();

            if (!token) {
                throw new Error('Authentication token is missing.');
            }

            const response = await fetch('/api/getUserData', {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                userData = await response.json();
                sessionStorage.setItem('userData', JSON.stringify(userData));
                sessionStorage.setItem('userDataTimestamp', now.toString());
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a few minutes and try again.');
            } else if (response.status === 401) {
                sessionStorage.clear();
                throw new Error('Unauthorized access. Please log in again.');
            } else {
                throw new Error('Failed to fetch user data');
            }
        }

        const publicData = userData.publicData || {};
        const privateData = userData.privateData || {};

        const name = publicData.name || 'User';
        const currency_balance = publicData.currency_balance || 0;
        const instrument = capitalizeFirstLetter(publicData.instrument || 'N/A');
        const email = privateData.email || 'N/A';

        const user = await getUser();
        profileName.textContent = `Welcome, ${name}!`;
        profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;
        profileImage.src = user && user.picture ? user.picture : placeholderPath;

        dashboardContent.innerHTML = `
            <div class="dashboard-card"><strong>Email:</strong> ${email}</div>
            <div class="dashboard-card"><strong>Class Period:</strong> ${publicData.class_period || 'N/A'}</div>
            <div class="dashboard-card"><strong>Instrument:</strong> ${instrument}</div>
        `;

        loader.classList.add('hidden');
    } catch (error) {
        console.error('Error fetching user data:', error);
        alert(`Could not load your data: ${error.message}`);
        loader.classList.add('hidden');
        window.location.href = '/pages/profile.html';
    }
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}