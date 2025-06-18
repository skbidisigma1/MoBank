/* Loads header & footer, manages auth-aware links + notifications  */
(async () => {
  await documentReady();

  const [$header, $footer] = await Promise.all([
    fetchFragment(headerPath()).then(insert('#header-placeholder')),
    fetchFragment(footerPath()).then(insert('#footer-placeholder'))
  ]);
  await window.auth0Promise;
  const isLoggedIn = await isAuthenticated();
  const user = isLoggedIn ? await getUser() : null;  setupNavLinks($header, isLoggedIn, user);
  setupProfilePic($header, user);
  setupParticleConfigButton($footer);
  await initNotifications($header, isLoggedIn);
  // kick off a fresh user-data fetch for the whole app
  window.userDataPromise = isLoggedIn ? fetchAndCacheUserData() : Promise.resolve(null);
  
  // Initialize particle settings
  initializeParticleSettings();
    // Update navigation links after user data is loaded
})().catch(console.error);

/* ---------- helpers ---------- */
const $$ = (sel) => document.querySelectorAll(sel);
function documentReady() {
  return new Promise((r) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', r, { once: true })
      : r()
  );
}

const insert = (sel) => async (html) => {
  const holder = document.querySelector(sel);
  holder.innerHTML = '';
  holder.append(...new DOMParser().parseFromString(html, 'text/html').body.children);
  return holder;
};

const fetchFragment = async (url) => {
  const res = await fetch(url);
  return res.ok ? res.text() : '';
};

const headerPath = () =>
  location.pathname.includes('/pages/') ? '../header.html' : 'header.html';
const footerPath = () =>
  location.pathname.includes('/pages/') ? '../footer.html' : 'footer.html';

async function fetchAndCacheUserData() {
  try {
    // Check cache first
    const cachedData = CACHE.read(CACHE.USER_KEY);
    if (cachedData) {
      return cachedData;
    }

    const token = await auth0Client.getTokenSilently();
    
    const res = await fetch('/api/getUserData', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('fetchAndCacheUserData: Request failed:', errorText);
      throw new Error(`status ${res.status}: ${errorText}`);
    }
      const responseData = await res.json();
    const data = responseData;
    
    CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
    
    return data;
  } catch (e) {
    console.error('fetchAndCacheUserData: User data fetch failed:', e);
    return null;
  }
}

/* ---------- header nav / auth ---------- */
function setupNavLinks($header, loggedIn, user = null) {
  const show = (sel, visible) => $header.querySelectorAll(sel).forEach((n) => (n.style.display = visible ? '' : 'none'));

  const roles = user?.['https://mo-classroom.us/roles'] || [];
  const isAdmin = roles.includes('admin');
  
  show('#admin-link, #admin-link-mobile', isAdmin);

  // logged-in links
  show('#leaderboard-link, #leaderboard-link-mobile', loggedIn);
  show('#dashboard-link, #dashboard-link-mobile', true);

  // auth link text/handler
  $header.querySelectorAll('#auth-link, #auth-link-mobile').forEach((lnk) => {
    if (loggedIn) {
      lnk.textContent = 'Logout';
      lnk.href = '#';      lnk.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        logoutUser();
      });
    } else {
      lnk.textContent = 'Login';
      lnk.href = 'login';
    }
  });
}

/* ---------- profile picture ---------- */
function setupProfilePic($header, user) {
  const img = $header.querySelector('#profile-pic');
  if (!img) return;

  img.src = user?.picture || '/images/default_profile.svg';
  img.addEventListener('click', () => (location.href = user ? 'dashboard' : 'login'));
}

/* ---------- particle config button ---------- */
function setupParticleConfigButton($footer) {
  const configBtn = $footer.querySelector('#particle-config-btn');
  if (!configBtn) return;

  configBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleParticleConfigClick();
  });
}

async function handleParticleConfigClick() {
  console.log('Particle configuration button clicked');
  await openParticleConfigModal();
}

async function openParticleConfigModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('particle-config-modal');
  if (!modal) {
    await createParticleConfigModal();
    modal = document.getElementById('particle-config-modal');
  }
  
  // Ensure modal exists before trying to manipulate it
  if (!modal) {
    console.error('Failed to create particle config modal');
    return;
  }
  
  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Focus trap for accessibility
  const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) firstFocusable.focus();
}

async function createParticleConfigModal() {
  try {
    const modalPath = location.pathname.includes('/pages/') ? '../particleConfig.html' : 'particleConfig.html';
    const response = await fetch(modalPath);
    const modalHTML = await response.text();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setupParticleModalEvents();
  } catch (error) {
    console.error('Failed to load particle config modal:', error);
  }
}

function setupParticleModalEvents() {
  const modal = document.getElementById('particle-config-modal');
  const closeBtn = document.getElementById('particle-modal-close');
  const closeFooterBtn = document.getElementById('particle-modal-close-footer');
  const resetBtn = document.getElementById('reset-defaults');
  
  const closeModal = () => {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };
  
  // Close events
  closeBtn?.addEventListener('click', closeModal);
  closeFooterBtn?.addEventListener('click', closeModal);
  
  // Click outside to close
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
  
  // Reset button
  resetBtn?.addEventListener('click', () => {
    resetToDefaults();
  });
  
  // Setup all config controls
  setupConfigControls();
  
  // Load saved settings
  loadParticleSettings();
}

function setupConfigControls() {
  // Checkboxes
  const checkboxes = ['particles-enabled', 'mouse-interaction', 'connect-lines'];
  checkboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        saveParticleSettings();
        applyParticleSettings();
      });
    }
  });
  
  // Sliders with value display
  const sliders = [
    { id: 'particle-count', suffix: '' },
    { id: 'animation-speed', suffix: 'x' },
    { id: 'particle-size', suffix: 'px' },
    { id: 'particle-opacity', suffix: '%', multiplier: 100 },
    { id: 'interaction-distance', suffix: 'px' }
  ];
  
  sliders.forEach(({ id, suffix, multiplier = 1 }) => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    
    if (slider && valueDisplay) {
      const updateValue = () => {
        const value = parseFloat(slider.value) * multiplier;
        valueDisplay.textContent = `${value}${suffix}`;
      };
      
      slider.addEventListener('input', updateValue);
      slider.addEventListener('change', () => {
        saveParticleSettings();
        applyParticleSettings();
      });
      
      updateValue(); // Initialize display
    }
  });
  
  // Color inputs
  const colorInputs = ['particle-color', 'line-color'];
  colorInputs.forEach(id => {
    const colorInput = document.getElementById(id);
    if (colorInput) {
      colorInput.addEventListener('change', () => {
        saveParticleSettings();
        applyParticleSettings();
      });
    }
  });
  
  // Preset buttons
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyPreset(preset);
    });
  });
}

// IndexedDB functions
async function initParticleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoBankParticles', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
  });
}

async function saveParticleSettings() {
  try {
    const settings = getCurrentSettings();
    const db = await initParticleDB();
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    
    await new Promise((resolve, reject) => {
      const request = store.put(settings, 'particleConfig');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    console.log('Particle settings saved to IndexedDB');
  } catch (error) {
    console.error('Failed to save particle settings:', error);
  }
}

function applyParticleSettings() {
  const settings = getCurrentSettings();
  
  // Apply to particle system
  if (window.particleControls && window.particleControls.updateConfig) {
    window.particleControls.updateConfig(settings);
  } else {
    // Store settings for when particle system loads
    window.pendingParticleSettings = settings;
  }
  
  console.log('Applied particle settings:', settings);
}

async function loadParticleSettings() {
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    
    const settings = await new Promise((resolve, reject) => {
      const request = store.get('particleConfig');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (settings) {
      applySettingsToControls(settings);
      // Don't apply settings immediately on load - wait for user interaction
      // Just populate the form with saved values
    } else {
      // Load defaults into form
      const defaults = getDefaultSettings();
      applySettingsToControls(defaults);
    }
  } catch (error) {
    console.error('Failed to load particle settings:', error);
    const defaults = getDefaultSettings();
    applySettingsToControls(defaults);
  }
}

function getDefaultSettings() {
  return {
    enabled: true,
    count: 50,
    speed: 1.0,
    particleColor: '#0066cc',
    lineColor: '#0066cc',
    size: 3,
    opacity: 0.8,
    mouseInteraction: true,
    connectLines: true,
    interactionDistance: 150
  };
}

function getCurrentSettings() {
  return {
    enabled: document.getElementById('particles-enabled')?.checked ?? true,
    count: parseInt(document.getElementById('particle-count')?.value ?? 50),
    speed: parseFloat(document.getElementById('animation-speed')?.value ?? 1.0),
    particleColor: document.getElementById('particle-color')?.value ?? '#0066cc',
    lineColor: document.getElementById('line-color')?.value ?? '#0066cc',
    size: parseFloat(document.getElementById('particle-size')?.value ?? 3),
    opacity: parseFloat(document.getElementById('particle-opacity')?.value ?? 0.8),
    mouseInteraction: document.getElementById('mouse-interaction')?.checked ?? true,
    connectLines: document.getElementById('connect-lines')?.checked ?? true,
    interactionDistance: parseInt(document.getElementById('interaction-distance')?.value ?? 150)
  };
}

function applySettingsToControls(settings) {
  Object.entries(settings).forEach(([key, value]) => {
    const element = document.getElementById(getControlId(key));
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = value;
      } else {
        element.value = value;
      }
    }
  });
  
  // Update slider value displays after a short delay to ensure elements are ready
  setTimeout(() => {
    updateAllSliderDisplays();
  }, 100);
}

function updateAllSliderDisplays() {
  const sliders = [
    { id: 'particle-count', suffix: '' },
    { id: 'animation-speed', suffix: 'x' },
    { id: 'particle-size', suffix: 'px' },
    { id: 'particle-opacity', suffix: '%', multiplier: 100 },
    { id: 'interaction-distance', suffix: 'px' }
  ];
  
  sliders.forEach(({ id, suffix, multiplier = 1 }) => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    
    if (slider && valueDisplay) {
      const value = parseFloat(slider.value) * multiplier;
      valueDisplay.textContent = `${value}${suffix}`;
    }
  });
}

function getControlId(settingKey) {
  const mapping = {
    enabled: 'particles-enabled',
    count: 'particle-count',
    speed: 'animation-speed',
    particleColor: 'particle-color',
    lineColor: 'line-color',
    size: 'particle-size',
    opacity: 'particle-opacity',
    mouseInteraction: 'mouse-interaction',
    connectLines: 'connect-lines',
    interactionDistance: 'interaction-distance'
  };
  return mapping[settingKey] || settingKey;
}

function applyPreset(presetName) {
  const presets = {
    minimal: {
      enabled: true,
      count: 20,
      speed: 0.5,
      particleColor: '#cccccc',
      lineColor: '#cccccc',
      size: 2,
      opacity: 0.4,
      mouseInteraction: false,
      connectLines: false,
      interactionDistance: 100
    },
    default: {
      enabled: true,
      count: 50,
      speed: 1.0,
      particleColor: '#0066cc',
      lineColor: '#0066cc',
      size: 3,
      opacity: 0.8,
      mouseInteraction: true,
      connectLines: true,
      interactionDistance: 150
    },
    energetic: {
      enabled: true,
      count: 80,
      speed: 2.0,
      particleColor: '#00b894',
      lineColor: '#00b894',
      size: 4,
      opacity: 0.9,
      mouseInteraction: true,
      connectLines: true,
      interactionDistance: 200
    },
    cosmic: {
      enabled: true,
      count: 100,
      speed: 0.8,
      particleColor: '#6c5ce7',
      lineColor: '#a29bfe',
      size: 2.5,
      opacity: 0.7,
      mouseInteraction: true,
      connectLines: true,
      interactionDistance: 180
    }
  };
  
  const preset = presets[presetName];
  if (preset) {
    applySettingsToControls(preset);
    saveParticleSettings();
    applyParticleSettings();
  }
}

function resetToDefaults() {
  applyPreset('default');
}

async function initializeParticleSettings() {
  try {
    // Load saved settings and apply them to the particle system
    const db = await initParticleDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    
    const savedSettings = await new Promise((resolve, reject) => {
      const request = store.get('particleConfig');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const settings = savedSettings || getDefaultSettings();
    
    // Apply settings to particle system if it's ready
    if (window.particleControls && window.particleControls.updateConfig) {
      window.particleControls.updateConfig(settings);
    } else {
      // Store for when particle system is ready
      window.pendingParticleSettings = settings;
      
      // Wait for particle system to be ready
      const checkParticleSystem = setInterval(() => {
        if (window.particleControls && window.particleControls.updateConfig && window.pendingParticleSettings) {
          window.particleControls.updateConfig(window.pendingParticleSettings);
          window.pendingParticleSettings = null;
          clearInterval(checkParticleSystem);
        }
      }, 500);
      
      // Clear interval after 10 seconds to prevent memory leaks
      setTimeout(() => clearInterval(checkParticleSystem), 10000);
    }
  } catch (error) {
    console.error('Failed to initialize particle settings:', error);
  }
}

/* ---------- notifications ---------- */
async function initNotifications($header, loggedIn) {
  const icon = $header.querySelector('#notification-icon');
  const countEl = $header.querySelector('#notification-count');
  const dropdown = $header.querySelector('#notification-dropdown');
  if (!icon || !dropdown || !countEl) return;

  let notifications = [];
  let unread = 0;

  function render() {
    countEl.textContent = unread;
    countEl.classList.toggle('hidden', unread === 0);

    dropdown.innerHTML = notifications.length
      ? `<div class="notification-header">
           <h4>Notifications (${unread} unread)</h4>
           <button class="notification-clear">Clear all</button>
         </div>`
      : '<p class="notification-empty">No notifications</p>';

    notifications.forEach((n, i) => {
      const ts = parseTimestamp(n.timestamp);
      const item = document.createElement('div');
      item.className = `notification-item ${n.read ? '' : 'unread'}`;
      item.style.setProperty('--item-index', i);
      item.innerHTML = `
        <div class="notification-message">${n.message}</div>
        <span class="notification-time" data-ts="${ts}">${relTime(ts)}</span>`;
      item.addEventListener('click', () => handleNotifClick(n));
      dropdown.appendChild(item);
    });

    dropdown.querySelector('.notification-clear')?.addEventListener('click', clearAll);
  }

  async function loadFromUser() {
    const data = await window.userDataPromise;
    if (data?.notifications) {
      notifications = [...data.notifications];
      unread = notifications.filter((n) => !n.read).length;
      render();
    }
  }

  async function markAllRead() {
    if (!loggedIn || !unread) return;
    unread = 0;
    notifications = notifications.map((n) => ({ ...n, read: true }));
    render();
    try {
      const token = await auth0Client.getTokenSilently();
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAsRead' })
      });
    } catch (e) {
      console.error('mark read failed:', e);
    }
  }

  async function clearAll(e) {
    e.stopPropagation();
    dropdown.querySelectorAll('.notification-item').forEach((el) => el.classList.add('fadeout'));
    setTimeout(render, 500);
    notifications = [];
    unread = 0;
    try {
      const token = await auth0Client.getTokenSilently();
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAll' })
      });
      localStorage.removeItem('userData');
    } catch (e) {
      console.error('clear notifications failed:', e);
    }
  }

  function handleNotifClick(n) {
    const url =
      n.type === 'admin_transfer' ? 'dashboard' :
      n.type === 'transfer_received' || n.type === 'user_transfer' ? 'transfer' :
      n.type === 'announcement' ? `${location.origin}?showAnnouncements=true&announcementId=${n.announcementId || ''}` :
      '';
    if (url) location.href = url;
  }

  /* toggle */
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.classList.toggle('visible');
    icon.classList.toggle('active');
    if (dropdown.classList.contains('visible')) markAllRead();
  };
  icon.addEventListener('click', toggle);
  icon.addEventListener('touchstart', toggle, { passive: false });
  document.addEventListener('click', (e) => !dropdown.contains(e.target) && dropdown.classList.remove('visible'));

  /* relative timestamp updater */
  setInterval(() => $$('[data-ts]').forEach((el) => (el.textContent = relTime(el.dataset.ts))), 60_000);

  await loadFromUser();
}

/* utilities */
const parseTimestamp = (ts) =>
  ts?._seconds * 1000 || ts?.seconds * 1000 || ts?.toDate?.().getTime() || Date.parse(ts) || Date.now();
const relTime = (ms) => {
  const diff = Date.now() - ms;
  const sec = diff / 1000 | 0, min = sec / 60 | 0, hr = min / 60 | 0, day = hr / 24 | 0;
  return sec < 60 ? 'just now' :
         min < 60 ? `${min}m ago` :
         hr < 24 ? `${hr}h ago` :
         day < 7 ? `${day}d ago` :
         new Date(ms).toLocaleDateString();
};

/* PWA manifest injection */
if (!document.querySelector('link[rel="manifest"]')) {
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = '/manifest.json';
  document.head.appendChild(l);
}