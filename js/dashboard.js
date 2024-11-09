document.addEventListener('DOMContentLoaded', async () => {
    await window.auth0Promise;

    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = '/pages/login.html';
        return;
    }

    const token = await getToken();

    try {
        const response = await fetch('/getUserData', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            if (userData.class_period == null || userData.instrument === "") {
                window.location.href = '/pages/profile.html';
            } else {
                displayUserData(userData);
            }
        } else {
            console.error('Failed to fetch user data');
            window.location.href = '/pages/profile.html';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
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
        <!-- Add more user data as needed -->
    `;
}