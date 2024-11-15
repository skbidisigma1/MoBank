document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const loader = document.getElementById('loader');
    const dashboardContent = document.getElementById('dashboard-content');
    const profileName = document.getElementById('profile-name');
    const profileCurrency = document.getElementById('profile-currency');

    loader.classList.remove('hidden');

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const token = await getToken();
    try {
        const response = await fetch('/api/getUserData', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const userData = await response.json();
            sessionStorage.setItem('userData', JSON.stringify(userData));

            profileName.textContent = `Welcome, ${userData.name}!`;
            profileCurrency.textContent = `Currency Balance: $${userData.currency_balance}`;

            dashboardContent.innerHTML = `
                <div class="dashboard-card"><strong>Email:</strong> ${userData.email}</div>
                <div class="dashboard-card"><strong>Class Period:</strong> ${userData.class_period}</div>
                <div class="dashboard-card"><strong>Instrument:</strong> ${userData.instrument}</div>
            `;
        } else {
            window.location.href = '/pages/profile.html';
        }
    } catch (error) {
        window.location.href = '/pages/profile.html';
    } finally {
        loader.classList.add('hidden');
    }
});
