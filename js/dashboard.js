document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const cachedUserData = JSON.parse(sessionStorage.getItem('userData'));
    if (cachedUserData) {
        displayUserData(cachedUserData);
    } else {
        displayUserData({ name: 'Loading...', email: 'Loading...', class_period: 'Loading...', instrument: 'Loading...', currency_balance: 'Loading...' });
    }

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
            displayUserData(userData);
        } else {
            window.location.href = '/pages/profile.html';
        }
    } catch (error) {
        window.location.href = '/pages/profile.html';
    }
});

function displayUserData(userData) {
    const dashboardContent = document.getElementById('dashboard-content');
    dashboardContent.innerHTML = `
        <p><strong>Name:</strong> ${userData.name}</p>
        <p><strong>Email:</strong> ${userData.email}</p>
        <p><strong>Class Period:</strong> ${userData.class_period}</p>
        <p><strong>Instrument:</strong> ${userData.instrument}</p>
        <p><strong>Currency Balance:</strong> ${userData.currency_balance}</p>
    `;
}
