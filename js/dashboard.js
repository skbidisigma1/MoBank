async function getCachedUser() {
  try {
    // Check cache first
    const cachedData = CACHE.read(CACHE.USER_KEY);
    if (cachedData) {
      return { data: cachedData, fresh: true };
    }

    // Don't fetch fresh data here - let headerFooter.js handle it
    return { data: null, fresh: false };
  } catch (error) {
    console.error('getCachedUser: Error getting cached user:', error);
    return { data: null, fresh: false };
  }
}

async function getToken() {
  const cached = CACHE.read(CACHE.TOKEN_KEY);
  
  if (cached && Date.now() - cached.timestamp < CACHE.TOKEN_MAX_AGE) {
    return cached.token;
  }
  
  try {
    const token = await auth0Client.getTokenSilently();
    CACHE.write(CACHE.TOKEN_KEY, { token, timestamp: Date.now() });
    return token;
  } catch (err) {
    console.error('getToken: Token fetch failed:', err);
    await signInWithAuth0();
    throw err;
  }
}

/* ---------- ui helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const periodNames = Object.fromEntries(
  (window.MOBANK_CLASS_PERIODS || []).map(period => [period.value, period.label])
);
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/* ---------- main ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  const loader = $('#loader');
  loader.classList.remove('hidden');

  // auth callback error passthrough
  const err = new URLSearchParams(location.search);
  if (err.get('error')) {
    location.replace(
      `login?error=${encodeURIComponent(err.get('error'))}&error_description=${encodeURIComponent(err.get('error_description') || '')}`
    );
    return;
  }

  await window.auth0Promise;          // ensure Auth0 ready
  
  await setProfileImage();            // doesn't depend on user data
  const { data: cachedUser, fresh } = await getCachedUser();
  if (cachedUser) {
    renderDashboard(cachedUser); // show immediately (even if stale)
  }
  // Wait a bit for headerFooter.js to set up the userDataPromise
  let attempts = 0;
  const maxAttempts = 10; // Wait up to 1 second (10 * 100ms)
  
  while (!window.userDataPromise && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    attempts++;
  }
  
  if (window.userDataPromise) {
    try {
      const liveUser = await window.userDataPromise;
      renderDashboard(liveUser);
    } catch (e) {
      console.error('Dashboard: Live user fetch failed:', e);
    }
  } else {
    // If we have cached data, we've already rendered it above
    if (!cachedUser) {
      console.warn('Dashboard: No cached data and no userDataPromise - this should not happen normally');
    }
  }
  initButtons();

  if (err.get('profile_successful') === 'true') {
    showToast('Success', 'Profile updated successfully!');
  }

  // Don't hide loader here - let it hide after data loads
});

/* ---------- dashboard rendering ---------- */
function renderDashboard(u = {}) {
  const loader = $('#loader');
  if (loader) {
    loader.classList.add('hidden');
  }
  
  $('#profile-name').textContent = `Welcome, ${u.name || 'User'}!`;

  const balance = Number(u.currency_balance || 0);
  const balStr = formatMoBucks(balance, { absolute: false });
  $('#profile-currency').innerHTML = `MoBuck Balance: <span id="currency-value">${balStr}</span>`;
  $('#currency-value').style.color = balance < 0 ? 'rgb(220,53,69)' : '';

  const periodLabel = (u.class_period == null)
    ? 'Not set – please select your class period'
    : (periodNames[u.class_period] || `Period ${u.class_period}`);
  const makeCard = (label, value) => {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    const heading = document.createElement('strong');
    heading.textContent = `${label}: `;
    const text = document.createElement('span');
    text.textContent = value;
    card.append(heading, text);
    return card;
  };
  $('#dashboard-content').replaceChildren(
    makeCard('Class Period', periodLabel),
    makeCard('Instrument', cap(u.instrument || ''))
  );
  renderTransactions(u.transactions || []);
}

function renderTransactions(txns) {
  const list = $('#transactions');
  list.innerHTML = '';

  if (!txns.length) {
    list.innerHTML = '<li class="transaction-empty">No transactions to show.</li>';
    return;
  }

  txns.forEach((t) => {
    const ts = t.timestamp?._seconds * 1000 + (t.timestamp?._nanoseconds || 0) / 1e6 || Date.now();
    const li = document.createElement('li');
    const type = t.type === 'credit' ? 'credit' : 'debit';
    const amount = document.createElement('span');
    amount.className = `transaction-amount ${type}`;
    amount.append(document.createTextNode(type === 'credit' ? '+' : '-'));
    const icon = document.createElement('span');
    icon.className = 'mobucks-icon';
    amount.append(icon, document.createTextNode(Math.abs(Number(t.amount) || 0).toLocaleString()));
    const details = document.createElement('span');
    details.className = 'transaction-details';
    const counterpart = document.createElement('span');
    counterpart.className = 'transaction-type';
    counterpart.textContent = `${type === 'credit' ? 'from' : 'to'} ${t.counterpart || 'Unknown'}`;
    const date = document.createElement('span');
    date.className = 'transaction-date';
    date.textContent = new Date(ts).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    details.append(counterpart, date);
    li.append(amount, details);
    list.appendChild(li);
  });
}

/* ---------- misc helpers ---------- */
async function refreshUserData() {
  try {
    const token = await getToken();
    const res = await fetch('/api/getUserData', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const responseData = await res.json();
      
      // The API returns the user data directly, not wrapped in a 'data' property
      const data = responseData;
      
      CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
      
      renderDashboard(data);
      return data;
    } else {
      const errorText = await res.text();
      console.error('refreshUserData: API request failed with status', res.status, 'and response:', errorText);
      throw new Error(`API request failed: ${res.status}`);
    }
  } catch (e) {
    console.error('refreshUserData: User refresh failed:', e);
    throw e;
  }
}

async function setProfileImage() {
  const img = $('.dashboard-profile-icon');
  img.src = '/images/default_profile.svg';
  try {
    const user = await auth0Client.getUser();
    if (user?.picture) img.src = user.picture;
  } catch (e) {
    console.error('profile img:', e);
  }
}

function initButtons() {
  const nav = (btn, to) => btn && btn.addEventListener('click', () => (location.href = to));
  nav($('#mostore-btn'), 'store');
  nav($('#motools-btn'), 'tools');
  nav($('#transfer-mobucks-btn'), 'transfer');
  nav($('#profile-btn'), 'profile');
  nav($('#leaderboard-btn'), 'leaderboard');
  $('#logout-btn')?.addEventListener('click', async () => {
    await logoutUser();
    location.href = 'login';
  });
}
