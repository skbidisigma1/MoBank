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

    async function fetchUserData() {
      try {
        const token = await getToken();
        const response = await fetch('/api/getUserData', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const userData = await response.json();
          if (!userData.class_period || !userData.instrument) {
            throw new Error('Incomplete profile data');
          }
          sessionStorage.setItem('userData', JSON.stringify(userData));
          sessionStorage.setItem('userDataTimestamp', Date.now().toString());

          const name = userData.name || 'User';
          const currency_balance = userData.currency_balance || 0;
          const instrument = capitalizeFirstLetter(userData.instrument || 'N/A');
          const email = userData.privateData.email || 'N/A';

          profileName.textContent = `Welcome, ${name}!`;
          profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;
          profileImage.src = userData.picture || '/images/default_profile.svg';

          dashboardContent.innerHTML = `
              <div class="dashboard-card"><strong>Email:</strong> ${email}</div>
              <div class="dashboard-card"><strong>Class Period:</strong> ${userData.class_period || 'N/A'}</div>
              <div class="dashboard-card"><strong>Instrument:</strong> ${instrument}</div>
          `;

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

    await fetchUserData();
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
