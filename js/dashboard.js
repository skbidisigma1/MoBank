document.addEventListener('DOMContentLoaded', async () => {
  await window.auth0Promise;

  const loader = document.getElementById('loader');
  const dashboardContent = document.getElementById('dashboard-content');
  const profileName = document.getElementById('profile-name');
  const profileCurrency = document.getElementById('profile-currency');
  const profileImage = document.querySelector('.dashboard-profile-icon');
  const placeholderPath = '/images/default_profile.svg';

  loader.classList.remove('hidden');

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
    const isLoggedIn = await isAuthenticated();
    if (!isLoggedIn) {
      window.location.href = '/pages/login.html';
      return;
    }

    const token = await getToken();
    try {
      const response = await fetch('/api/getUserData', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();

        const publicData = userData.publicData || {};
        const privateData = userData.privateData || {};
        const dataToCache = {
          name: publicData.name || 'User',
          currency_balance: publicData.currency_balance || 0,
          picture: privateData.picture || placeholderPath,
          email: privateData.email,
          class_period: publicData.class_period,
          instrument: publicData.instrument,
        };

        sessionStorage.setItem('userData', JSON.stringify(dataToCache));

        profileImage.src = dataToCache.picture || placeholderPath;
        profileName.textContent = `Welcome, ${dataToCache.name}!`;
        profileCurrency.textContent = `MoBuck Balance: $${dataToCache.currency_balance}`;
        dashboardContent.innerHTML = `
          <div class="dashboard-card"><strong>Email:</strong> ${dataToCache.email || 'N/A'}</div>
          <div class="dashboard-card"><strong>Class Period:</strong> ${dataToCache.class_period || 'N/A'}</div>
          <div class="dashboard-card"><strong>Instrument:</strong> ${dataToCache.instrument || 'N/A'}</div>
        `;
      } else {
        window.location.href = '/pages/profile.html';
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      window.location.href = '/pages/profile.html';
    }
  }

  loader.classList.add('hidden');
});