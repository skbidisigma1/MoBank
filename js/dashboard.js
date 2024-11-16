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
            await logoutUser();
            window.location.href = '/pages/login.html';
        });
    }

    try {
        const user = await getUser();
        const token = await getToken();

        const response = await fetch('/api/getUserData', {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
            const userData = await response.json();

            const publicData = userData.publicData || {};
            const privateData = userData.privateData || {};

            const name = publicData.name || 'User';
            const currency_balance = publicData.currency_balance || 0;
            const instrument = capitalizeFirstLetter(publicData.instrument || 'N/A');
            const email = privateData.email || 'N/A';

            profileName.textContent = `Welcome, ${name}!`;
            profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;
            profileImage.src = user && user.picture ? user.picture : placeholderPath;

            dashboardContent.innerHTML = `
                <div class="dashboard-card"><strong>Email:</strong> ${email}</div>
                <div class="dashboard-card"><strong>Class Period:</strong> ${publicData.class_period || 'N/A'}</div>
                <div class="dashboard-card"><strong>Instrument:</strong> ${instrument}</div>
            `;

            loader.classList.add('hidden');
        } else {
            throw new Error('Failed to fetch user data');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Could not load your data. Please try again later.');
        loader.classList.add('hidden');
        window.location.href = '/pages/profile.html';
    }
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
