// dashboard.js
import { getUserData } from './userData.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Wait for Auth0 to initialize
        await window.auth0Promise;

        const loader = document.getElementById('loader');
        const dashboardContent = document.getElementById('dashboard-content');
        const profileName = document.getElementById('profile-name');
        const profileCurrency = document.getElementById('profile-currency');
        const profileImage = document.querySelector('.dashboard-profile-icon');
        const placeholderPath = '/images/default_profile.svg';

        // Show loader
        loader.classList.remove('hidden');

        // Function to update the dashboard with user data
        const updateDashboard = () => {
            const cachedUserData = JSON.parse(sessionStorage.getItem('userData'));
            console.log('Dashboard - Cached User Data:', cachedUserData);

            if (cachedUserData) {
                const pictureUrl = cachedUserData.picture || placeholderPath;
                console.log('Dashboard - Setting profile image to:', pictureUrl);
                profileImage.src = pictureUrl;

                // Set error handler
                profileImage.onerror = function() {
                    console.error('Dashboard - Failed to load profile image. Reverting to placeholder.');
                    this.src = placeholderPath;
                };

                profileName.textContent = `Welcome, ${cachedUserData.name || 'User'}!`;
                profileCurrency.textContent = `MoBuck Balance: $${cachedUserData.currency_balance || 0}`;
                dashboardContent.innerHTML = `
                    <div class="dashboard-card"><strong>Email:</strong> ${cachedUserData.email || 'N/A'}</div>
                    <div class="dashboard-card"><strong>Class Period:</strong> ${cachedUserData.class_period || 'N/A'}</div>
                    <div class="dashboard-card"><strong>Instrument:</strong> ${cachedUserData.instrument || 'N/A'}</div>
                `;
            } else {
                console.log('Dashboard - No cached user data found.');
                // Optionally, fetch user data or redirect to login
            }
        };

        // Initial dashboard update
        updateDashboard();

        // Listen for updates to userData
        window.addEventListener('userDataUpdated', () => {
            console.log('Dashboard - userDataUpdated event received.');
            updateDashboard();
        });

        // Hide loader
        loader.classList.add('hidden');

    } catch (error) {
        console.error('Dashboard Initialization Error:', error);
        loader.classList.add('hidden');
        // Optionally, redirect or show an error message to the user
    }
});