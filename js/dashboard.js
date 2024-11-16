document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.auth0Promise; // Ensure Auth0 is initialized

        const loader = document.getElementById('loader');
        const dashboardContent = document.getElementById('dashboard-content');
        const profileName = document.getElementById('profile-name');
        const profileCurrency = document.getElementById('profile-currency');
        const profileImage = document.querySelector('.dashboard-profile-icon');
        const placeholderPath = '/images/default_profile.svg';

        loader.classList.remove('hidden');

        // Use sessionStorage if user data is already cached
        const cachedUserData = JSON.parse(sessionStorage.getItem('userData'));

        if (cachedUserData) {
            profileImage.src = cachedUserData.picture || placeholderPath;
            profileName.textContent = `Welcome, ${cachedUserData.name || 'User'}!`;
            profileCurrency.textContent = `MoBuck Balance: $${cachedUserData.currency_balance || 0}`;
            dashboardContent.innerHTML = `
                <div class="dashboard-card"><strong>Email:</strong> ${cachedUserData.email || 'N/A'}</div>
                <div class="dashboard-card"><strong>Class Period:</strong> ${cachedUserData.class_period || 'N/A'}</div>
                <div class="dashboard-card"><strong>Instrument:</strong> ${cachedUserData.instrument || 'N/A'}</div>
            `;
        } else {
            // Fetch fresh user data from Auth0
            const user = await getUser();
            if (!user) {
                window.location.href = '/pages/login.html';
                return;
            }

            const userData = {
                name: user.name || 'User',
                currency_balance: user.currency_balance || 0,
                picture: user.picture || placeholderPath,
                email: user.email || 'N/A',
                class_period: user.class_period || 'N/A',
                instrument: user.instrument || 'N/A'
            };

            sessionStorage.setItem('userData', JSON.stringify(userData));

            profileImage.src = userData.picture;
            profileName.textContent = `Welcome, ${userData.name}!`;
            profileCurrency.textContent = `MoBuck Balance: $${userData.currency_balance}`;
            dashboardContent.innerHTML = `
                <div class="dashboard-card"><strong>Email:</strong> ${userData.email}</div>
                <div class="dashboard-card"><strong>Class Period:</strong> ${userData.class_period}</div>
                <div class="dashboard-card"><strong>Instrument:</strong> ${userData.instrument}</div>
            `;
        }

        profileImage.onerror = function () {
            this.src = placeholderPath;
        };

        loader.classList.add('hidden');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        window.location.href = '/pages/login.html';
    }
});