document.addEventListener('DOMContentLoaded', async () => {
  await window.auth0Promise;

  const loader = document.getElementById('loader');
  const dashboardContent = document.getElementById('dashboard-content');
  const profileName = document.getElementById('profile-name');
  const profileCurrency = document.getElementById('profile-currency');
  const profileImage = document.querySelector('.dashboard-profile-icon'); // Larger 80px profile image
  const placeholderPath = '/images/default_profile.svg';

  loader.classList.remove('hidden');

  const cachedUserData = JSON.parse(sessionStorage.getItem('userData'));
  if (cachedUserData) {
    const { name, currency_balance, picture } = cachedUserData;

    profileName.textContent = `Welcome, ${name || 'User'}!`;
    profileCurrency.textContent = `MoBuck Balance: $${currency_balance || 0}`;
    profileImage.src = picture || placeholderPath;

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
        const name = publicData.name || 'User';
        const currency_balance = publicData.currency_balance || 0;
        const picture = privateData.picture || placeholderPath;

        profileName.textContent = `Welcome, ${name}!`;
        profileCurrency.textContent = `MoBuck Balance: $${currency_balance}`;
        profileImage.src = picture;

        dashboardContent.innerHTML = `
          <div class="dashboard-card"><strong>Email:</strong> ${privateData.email || 'N/A'}</div>
          <div class="dashboard-card"><strong>Class Period:</strong> ${publicData.class_period || 'N/A'}</div>
          <div class="dashboard-card"><strong>Instrument:</strong> ${publicData.instrument || 'N/A'}</div>
        `;

        sessionStorage.setItem('userData', JSON.stringify({
          name,
          currency_balance,
          picture,
          email: privateData.email,
          class_period: publicData.class_period,
          instrument: publicData.instrument,
        }));
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