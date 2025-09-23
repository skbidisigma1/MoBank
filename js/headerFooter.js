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
  window.userDataPromise = isLoggedIn ? fetchAndCacheUserData() : Promise.resolve(null);
  if (isLoggedIn) {
    try {
      window.userDataPromise.then((ud) => {
        if (!ud) return;
        const cp = ud.class_period;
        const current = location.pathname.split('/').pop();
        const isProfile = current === 'profile' || current === 'profile.html';
        const protectedPages = [
          'dashboard.html','admin.html','transfer.html','leaderboard.html','cute.html',
          'dashboard','admin','transfer','leaderboard','cute'
        ];
        const privacyPages = ['privacy.html','privacy','tos.html','tos'];
        if (!isProfile && protectedPages.includes(current) && (cp === null || typeof cp === 'undefined')) {
          location.replace('profile?welcome=1');
        }
        if (privacyPages.includes(current) && (cp !== null && typeof cp !== 'undefined')) {
          window.auth0Promise = Promise.resolve();
          return;
        }
      });
    } catch (e) {
      console.warn('class_period redirect check failed:', e);
    }
  }
  
  await initializeParticleSettings();
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
  let modal = document.getElementById('particle-config-modal');
  if (!modal) {
    await createParticleConfigModal();
    modal = document.getElementById('particle-config-modal');
  }
  
  if (!modal) {
    console.error('Failed to create particle config modal');
    return;
  }
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  await loadCustomPresets();
  
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
    
    clearTimeout(window.particleUpdateTimeout);
    
    const settings = getCurrentSettings();
    if (window.particleControls && window.particleControls.updateConfig) {
      setTimeout(() => {
        try {
          window.particleControls.updateConfig(settings);
        } catch (error) {
          console.warn('Error applying final settings:', error);
        }
      }, 100);
    }
  };
  
  closeBtn?.addEventListener('click', closeModal);
  closeFooterBtn?.addEventListener('click', closeModal);
  
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
  
  resetBtn?.addEventListener('click', () => {
    resetToDefaults();
  });
  
  setupConfigControls();
  
  loadParticleSettings();
}

function setupConfigControls() {
  try {
    const checkboxes = [
      'particles-enabled', 'reduced-motion', 'size-random', 'opacity-random', 'move-enable',
      'move-attract', 'line-linked-enable', 'line-linked-shadow', 'line-warp', 
      'line-triangles', 'resize-enable', 'retina-detect'
    ];
    
    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          try {
            handleConfigChange();
            updateVisibilityBasedOnSelections();
          } catch (error) {
            console.warn(`Error handling change for ${id}:`, error);
          }
        });
      }
    });

  // surprise surprise, sliders
  const sliders = [
    { id: 'particle-count', suffix: '', precision: 0 },
    { id: 'polygon-sides', suffix: '', precision: 0 },
    { id: 'star-sides', suffix: '', precision: 0 },
    { id: 'particle-size', suffix: 'px', precision: 1 },
    { id: 'size-variation', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'particle-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'opacity-variation', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'move-speed', suffix: '', precision: 1 },
    { id: 'attract-rotate-x', suffix: '', precision: 0 },
    { id: 'attract-rotate-y', suffix: '', precision: 0 },
    { id: 'line-linked-distance', suffix: 'px', precision: 0 },
    { id: 'line-linked-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'line-linked-width', suffix: 'px', precision: 1 },
    { id: 'triangle-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'line-shadow-blur', suffix: 'px', precision: 0 },
    { id: 'push-particles-nb', suffix: '', precision: 0 }
  ];
  
  sliders.forEach(({ id, suffix, multiplier = 1, precision = 1 }) => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    
    if (slider && valueDisplay) {
      const updateValue = () => {
        const value = parseFloat(slider.value) * multiplier;
        const displayValue = precision === 0 ? Math.round(value) : value.toFixed(precision);
        valueDisplay.textContent = `${displayValue}${suffix}`;
      };
      
      slider.addEventListener('input', updateValue);
      slider.addEventListener('change', () => {
        handleConfigChange();
      });
      
      setupEditableValue(valueDisplay, slider, suffix, multiplier, precision);
      
      updateValue();
    }
  });
  
  const colorInputs = [
    'particle-color', 'line-linked-color', 'triangle-color', 'line-shadow-color'
  ];
  colorInputs.forEach(id => {
    const colorInput = document.getElementById(id);
    if (colorInput) {
      colorInput.addEventListener('change', () => {
        handleConfigChange();
      });
    }
  });
  
  // select dropdowns
  const selects = [
    'particle-shape', 'color-mode', 'move-type', 'move-direction', 'move-out-mode',
    'detect-on', 'click-mode'
  ];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.addEventListener('change', () => {
        handleConfigChange();
        updateVisibilityBasedOnSelections();
      });
    }
  });
  
  const textInputs = [
    'image-source'
  ];
  textInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        handleConfigChange();
      });
    }
  });
  
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      applyPreset(preset);
    });
  });
  
  setupSpecialButtons();
  
  updateVisibilityBasedOnSelections();
  
  } catch (error) {
    console.error('Error setting up config controls:', error);
  }
}

function setupEditableValue(valueElement, slider, suffix, multiplier = 1, precision = 1) {
  if (!valueElement.classList.contains('editable-value')) return;
  
  valueElement.addEventListener('click', () => {
    const currentValue = parseFloat(slider.value) * multiplier;
    const displayValue = precision === 0 ? Math.round(currentValue) : currentValue.toFixed(precision);
    
    const input = document.createElement('input');
    input.type = 'number';
    input.value = displayValue;
    input.className = 'editable-value editing';
    input.style.width = valueElement.offsetWidth + 'px';
    input.step = precision === 0 ? '1' : (1 / Math.pow(10, precision)).toString();
    
    const min = parseFloat(slider.min) * multiplier;
    const max = parseFloat(slider.max) * multiplier;
    input.min = precision === 0 ? Math.round(min) : min.toFixed(precision);
    input.max = precision === 0 ? Math.round(max) : max.toFixed(precision);
    
    valueElement.parentNode.replaceChild(input, valueElement);
    input.focus();
    input.select();
    
    let isFinished = false;
    const finishEdit = () => {
      if (isFinished) return; // Prevent multiple calls
      isFinished = true;
      
      let newValue = parseFloat(input.value);
      if (isNaN(newValue)) {
        newValue = parseFloat(slider.value) * multiplier;
      }
      
      newValue = Math.max(min, Math.min(max, newValue));
      
      slider.value = newValue / multiplier;
      
      const finalDisplay = precision === 0 ? Math.round(newValue) : newValue.toFixed(precision);
      valueElement.textContent = `${finalDisplay}${suffix}`;
      
      try {
        if (input.parentNode && input.parentNode.contains(input)) {
          input.parentNode.replaceChild(valueElement, input);
        }
      } catch (error) {
        if (!valueElement.parentNode) {
          input.parentNode?.appendChild(valueElement);
        }
      }
      
      handleConfigChange();
    };
    
    const cancelEdit = () => {
      if (isFinished) return;
      isFinished = true;
      
      try {
        if (input.parentNode && input.parentNode.contains(input)) {
          input.parentNode.replaceChild(valueElement, input);
        }
      } catch (error) {
        if (!valueElement.parentNode) {
          input.parentNode?.appendChild(valueElement);
        }
      }
    };
    
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    });
  });
}

function setupSpecialButtons() {
  const addColorBtn = document.getElementById('add-color-btn');
  if (addColorBtn) {
    addColorBtn.addEventListener('click', addNewColor);
  }
  
  const savePresetBtn = document.getElementById('preset-save-btn');
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', showSavePresetDialog);
  }
  
  const importBtn = document.getElementById('import-config-btn');
  const exportBtn = document.getElementById('export-config-btn');
  
  if (importBtn) {
    importBtn.addEventListener('click', importConfiguration);
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportConfiguration);
  }
  
  const fileInput = document.getElementById('config-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleConfigImport);
  }
}

function sanitizeSettings(settings) {
  const sanitized = { ...settings };
  
  if (sanitized.count < 0) sanitized.count = 0;
  if (sanitized.size <= 0) sanitized.size = 1;
  if (sanitized.moveSpeed < 0) sanitized.moveSpeed = 0;
  if (sanitized.lineLinkedDistance < 0) sanitized.lineLinkedDistance = 0;
  if (sanitized.lineLinkedWidth <= 0) sanitized.lineLinkedWidth = 1;
  
  sanitized.opacity = Math.max(0, Math.min(1, sanitized.opacity));
  sanitized.lineLinkedOpacity = Math.max(0, Math.min(1, sanitized.lineLinkedOpacity));
  sanitized.sizeVariation = Math.max(0, Math.min(1, sanitized.sizeVariation));
  sanitized.opacityVariation = Math.max(0, Math.min(1, sanitized.opacityVariation));
  
  if (sanitized.shape === 'polygon') {
    sanitized.polygonSides = Math.max(3, Math.min(20, sanitized.polygonSides));
  }
  if (sanitized.shape === 'star') {
    sanitized.starSides = Math.max(3, Math.min(20, sanitized.starSides));
  }
  
  sanitized.attractRotateX = Math.max(0, Math.min(5000, sanitized.attractRotateX));
  sanitized.attractRotateY = Math.max(0, Math.min(5000, sanitized.attractRotateY));
  
  if (sanitized.clickMode !== 'none') {
    sanitized.pushParticlesNb = Math.max(1, Math.min(50, sanitized.pushParticlesNb));
  }
  
  return sanitized;
}

function handleConfigChange() {
  let settings = getCurrentSettings();
  
  settings = sanitizeSettings(settings);
  
  const validation = validateParticleSettings(settings);
  
  if (!validation.isValid) {
    showToast('Configuration Error', validation.errors[0], 'error');
    return;
  }
  
  // probably a stupid system
  if (validation.warnings.length > 0) {
    if (Math.random() < 0.3) {
      showToast('Performance Note', validation.warnings[0], 'warning');
    }
  }
  
  window.currentParticleSettings = settings;
  saveParticleSettings(settings);
  applyParticleSettings(settings);
}

function validateParticleSettings(settings) {
  const errors = [];
  const warnings = [];

  // validate everything
  if (settings.count < 0) {
    errors.push("Particle count cannot be negative");
  } else if (settings.count > 1000) {
    warnings.push("Very high particle count (>1000) may cause performance issues");
  } else if (settings.count > 500) {
    warnings.push("High particle count (>500) may affect performance on slower devices");
  }

  if (settings.size <= 0) {
    errors.push("Particle size must be greater than 0");
  } else if (settings.size > 100) {
    warnings.push("Very large particle size (>100px) may look overwhelming");
  }

  if (settings.opacity < 0 || settings.opacity > 1) {
    errors.push("Particle opacity must be between 0 and 1");
  } else if (settings.opacity < 0.1) {
    warnings.push("Very low opacity (<0.1) may make particles nearly invisible");
  }

  if (settings.sizeVariation < 0 || settings.sizeVariation > 1) {
    errors.push("Size variation must be between 0% and 100%");
  }
  if (settings.opacityVariation < 0 || settings.opacityVariation > 1) {
    errors.push("Opacity variation must be between 0% and 100%");
  }

  if (settings.moveSpeed < 0) {
    errors.push("Movement speed cannot be negative");
  } else if (settings.moveSpeed > 20) {
    warnings.push("Very high movement speed (>20) may cause motion sickness");
  }

  if (settings.shape === 'polygon' && (settings.polygonSides < 3 || settings.polygonSides > 20)) {
    errors.push("Polygon sides must be between 3 and 20");
  }
  if (settings.shape === 'star' && (settings.starSides < 3 || settings.starSides > 20)) {
    errors.push("Star points must be between 3 and 20");
  }

  if (settings.shape === 'image') {
    if (!settings.imageSource || settings.imageSource.trim() === '') {
      errors.push("Image URL is required when using image shape");
    } else if (!isValidImageUrl(settings.imageSource)) {
      warnings.push("Image URL should end with .png, .jpg, .jpeg, .gif, .svg, or .webp");
    }
  }

  if (settings.lineLinkedEnable) {
    if (settings.lineLinkedDistance < 0) {
      errors.push("Line distance cannot be negative");
    } else if (settings.lineLinkedDistance > 1000) {
      warnings.push("Very high line distance (>1000px) may connect all particles");
    }
    
    if (settings.lineLinkedOpacity < 0 || settings.lineLinkedOpacity > 1) {
      errors.push("Line opacity must be between 0 and 1");
    }
    
    if (settings.lineLinkedWidth <= 0) {
      errors.push("Line width must be greater than 0");
    } else if (settings.lineLinkedWidth > 20) {
      warnings.push("Very thick lines (>20px) may dominate the visual");
    }
  }

  if (settings.clickMode !== 'none') {
    if (settings.pushParticlesNb < 1 || settings.pushParticlesNb > 50) {
      errors.push("Click effect particle count must be between 1 and 50");
    } else if (settings.pushParticlesNb > 20) {
      warnings.push("High click effect count (>20) may cause performance spikes");
    }
  }

  if (settings.moveAttract) {
    if (settings.attractRotateX < 0 || settings.attractRotateX > 5000) {
      errors.push("Attract Rotate X must be between 0 and 5000");
    }
    if (settings.attractRotateY < 0 || settings.attractRotateY > 5000) {
      errors.push("Attract Rotate Y must be between 0 and 5000");
    }
  }

  const performanceScore = calculatePerformanceScore(settings);
  if (performanceScore > 80) {
    warnings.push("Current settings may cause performance issues on slower devices");
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

function isValidImageUrl(url) {
  try {
    const urlObj = new URL(url);
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    return validExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

function calculatePerformanceScore(settings) {
  let score = 0;
  
  score += Math.min(settings.count / 10, 30);
  
  score += Math.min(settings.size / 2, 15);
  
  if (settings.moveEnable) {
    score += Math.min(settings.moveSpeed * 2, 10);
  }
  
  if (settings.lineLinkedEnable) {
    score += 15;
    score += Math.min(settings.lineLinkedDistance / 50, 10);
  }
  
  if (settings.clickMode !== 'none') score += 5;
  if (settings.moveAttract) score += 10;
  if (settings.lineTriangles) score += 10;
  if (settings.lineLinkedShadow) score += 5;
  
  return Math.min(score, 100);
}

function getCurrentSettings() {
  return {
    enabled: document.getElementById('particles-enabled')?.checked ?? true,
    reducedMotion: document.getElementById('reduced-motion')?.checked ?? false,
    count: parseInt(document.getElementById('particle-count')?.value ?? 50),
    shape: document.getElementById('particle-shape')?.value ?? 'circle',
    polygonSides: parseInt(document.getElementById('polygon-sides')?.value ?? 5),
    starSides: parseInt(document.getElementById('star-sides')?.value ?? 5),
    imageSource: document.getElementById('image-source')?.value ?? '',
    colorMode: document.getElementById('color-mode')?.value ?? 'single',
    particleColor: document.getElementById('particle-color')?.value ?? '#0066cc',
    colors: getMultipleColors(),
    size: parseFloat(document.getElementById('particle-size')?.value ?? 3),
    sizeRandom: document.getElementById('size-random')?.checked ?? false,
    sizeVariation: parseFloat(document.getElementById('size-variation')?.value ?? 0.5),
    opacity: parseFloat(document.getElementById('particle-opacity')?.value ?? 0.5),
    opacityRandom: document.getElementById('opacity-random')?.checked ?? false,
    opacityVariation: parseFloat(document.getElementById('opacity-variation')?.value ?? 0.3),
    moveEnable: document.getElementById('move-enable')?.checked ?? true,
    moveSpeed: parseFloat(document.getElementById('move-speed')?.value ?? 1),
    moveType: document.getElementById('move-type')?.value ?? 'default',
    moveDirection: document.getElementById('move-direction')?.value ?? 'none',
    moveOutMode: document.getElementById('move-out-mode')?.value ?? 'out',
    moveAttract: document.getElementById('move-attract')?.checked ?? false,
    attractRotateX: parseFloat(document.getElementById('attract-rotate-x')?.value ?? 600),
    attractRotateY: parseFloat(document.getElementById('attract-rotate-y')?.value ?? 1200),
    lineLinkedEnable: document.getElementById('line-linked-enable')?.checked ?? true,
    lineLinkedDistance: parseFloat(document.getElementById('line-linked-distance')?.value ?? 150),
    lineLinkedColor: document.getElementById('line-linked-color')?.value ?? '#0066cc',
    lineLinkedOpacity: parseFloat(document.getElementById('line-linked-opacity')?.value ?? 0.4),
    lineLinkedWidth: parseFloat(document.getElementById('line-linked-width')?.value ?? 1),
    lineLinkedShadow: document.getElementById('line-linked-shadow')?.checked ?? false,
    lineWarp: document.getElementById('line-warp')?.checked ?? false,
    lineTriangles: document.getElementById('line-triangles')?.checked ?? false,
    triangleColor: document.getElementById('triangle-color')?.value ?? '#0066cc',
    triangleOpacity: parseFloat(document.getElementById('triangle-opacity')?.value ?? 0.5),
    lineShadowColor: document.getElementById('line-shadow-color')?.value ?? '#000000',
    lineShadowBlur: parseFloat(document.getElementById('line-shadow-blur')?.value ?? 5),
    detectOn: document.getElementById('detect-on')?.value ?? 'canvas',
    clickMode: document.getElementById('click-mode')?.value ?? 'push',
    resizeEnable: document.getElementById('resize-enable')?.checked ?? true,
    pushParticlesNb: parseInt(document.getElementById('push-particles-nb')?.value ?? 4),
    retinaDetect: document.getElementById('retina-detect')?.checked ?? true
  };
}

function getMultipleColors() {
  const colorInputs = document.querySelectorAll('#color-list input[type="color"]');
  return Array.from(colorInputs).map(input => input.value);
}

function addNewColor() {
  const colorList = document.getElementById('color-list');
  if (!colorList) return;
  
  const colorItem = document.createElement('div');
  colorItem.className = 'color-item';
  colorItem.innerHTML = `
    <input type="color" value="#0066cc" class="config-color">
    <button type="button" class="color-remove-btn">Remove</button>
  `;
  
  const removeBtn = colorItem.querySelector('.color-remove-btn');
  removeBtn.addEventListener('click', () => {
    colorItem.remove();
    handleConfigChange();
  });
  
  const colorInput = colorItem.querySelector('input[type="color"]');
  colorInput.addEventListener('change', handleConfigChange);
  
  colorList.appendChild(colorItem);
  handleConfigChange();
}

// indexedDB particle settings
async function initParticleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoBankParticles', 3);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets');
      }
    };
  });
}

async function saveParticleSettings(settings) {
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    
    await new Promise((resolve, reject) => {
      const request = store.put(settings, 'particleConfig');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save particle settings:', error);
  }
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
    
    return settings || getDefaultParticleSettings();
  } catch (error) {
    console.error('Failed to load particle settings:', error);
    return getDefaultParticleSettings();
  }
}

// Custom preset management functions
async function saveCustomPresetInternal(name, settings) {
  try {
    // Validate settings before saving
    const validation = validateParticleSettings(settings);
    if (!validation.isValid) {
      showToast('Save Failed', `Cannot save preset: ${validation.errors[0]}`, 'error');
      return false;
    }
    
    // Sanitize settings
    const sanitizedSettings = sanitizeSettings(settings);
    
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readwrite');
    const store = transaction.objectStore('presets');
    
    const preset = {
      name,
      settings: sanitizedSettings,
      createdAt: new Date().toISOString()
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(preset, name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    await loadCustomPresets();
    return true;
  } catch (error) {
    console.error('Failed to save custom preset:', error);
    return false;
  }
}

async function loadCustomPresets() {
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readonly');
    const store = transaction.objectStore('presets');
    
    const presets = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    // Validate and filter presets
    const validPresets = [];
    const invalidPresets = [];
    
    presets.forEach(preset => {
      try {
        const settings = convertPresetToSettings(preset);
        const validation = validateParticleSettings(settings);
        
        if (validation.isValid) {
          validPresets.push(preset);
        } else {
          console.warn(`Invalid preset "${preset.name}":`, validation.errors);
          invalidPresets.push(preset);
        }
      } catch (error) {
        console.warn(`Corrupted preset "${preset.name}":`, error);
        invalidPresets.push(preset);
      }
    });
    
    // Remove invalid presets from storage
    if (invalidPresets.length > 0) {
      try {
        const deleteTransaction = db.transaction(['presets'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('presets');
        
        for (const preset of invalidPresets) {
          deleteStore.delete(preset.name);
        }
        
        showToast('Presets Cleaned', `${invalidPresets.length} invalid preset(s) were removed`, 'warning');
      } catch (error) {
        console.error('Failed to clean invalid presets:', error);
      }
    }
    
    displayCustomPresets(validPresets);
    return validPresets;
  } catch (error) {
    console.error('Failed to load custom presets:', error);
    return [];
  }
}

function displayCustomPresets(presets) {
  const container = document.getElementById('custom-presets');
  const noPresetsMsg = container.querySelector('.no-custom-presets');
  
  if (!container) return;
  
  // Clear existing presets (but keep the "no presets" message)
  const existingPresets = container.querySelectorAll('.custom-preset-item');
  existingPresets.forEach(item => item.remove());
  
  if (!presets || presets.length === 0) {
    if (noPresetsMsg) noPresetsMsg.style.display = 'block';
    return;
  }
  
  if (noPresetsMsg) noPresetsMsg.style.display = 'none';
  
  presets.forEach(preset => {
    const presetItem = document.createElement('div');
    presetItem.className = 'custom-preset-item config-row';
    presetItem.innerHTML = `
      <div class="custom-preset-info">
        <button class="preset-btn custom-preset-btn" data-custom-preset="${preset.name}">
          ${preset.name}
        </button>
        <small class="preset-date">Saved: ${new Date(preset.createdAt).toLocaleDateString()}</small>
      </div>
      <button class="custom-preset-delete" data-preset-name="${preset.name}" title="Delete preset">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
        </svg>
      </button>
    `;
    
    // Add load preset event
    const loadBtn = presetItem.querySelector('.custom-preset-btn');
    loadBtn.addEventListener('click', () => loadCustomPreset(preset.name));
    
    // Add delete preset event
    const deleteBtn = presetItem.querySelector('.custom-preset-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustomPresetConfirm(preset.name);
    });
    
    container.appendChild(presetItem);
  });
}

async function loadCustomPreset(name) {
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readonly');
    const store = transaction.objectStore('presets');
    
    const preset = await new Promise((resolve, reject) => {
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (preset && preset.settings) {
      applySettingsToControls(preset.settings);
      handleConfigChange();
      showToast(`Loaded preset: ${name}`, 'success');
    } else {
      showToast('Preset not found', 'error');
    }
  } catch (error) {
    console.error('Failed to load custom preset:', error);
    showToast('Failed to load preset', 'error');
  }
}

function deleteCustomPresetConfirm(name) {
  showConfirmModal(
    'Delete Preset', 
    `Are you sure you want to delete the preset "${name}"? This cannot be undone.`,
    () => {
      deleteCustomPreset(name).then(success => {
        if (success) {
          showToast(`Deleted preset: ${name}`, 'success');
        } else {
          showToast('Failed to delete preset', 'error');
        }
      });
    }
  );
}

function showSavePresetDialog() {
  console.log('Save preset button clicked - opening input modal');
  showInputModal('Save Custom Preset', 'Enter a name for this preset:', '', (name) => {
    // name is already trimmed and validated by showInputModal
    console.log('Preset name received:', name);
    const settings = getCurrentSettings();
    saveCustomPresetInternal(name, settings).then(success => {
      if (success) {
        showToast(`Saved preset: ${name}`, 'success');
      } else {
        showToast('Failed to save preset', 'error');
      }
    });
  });
}

function showToast(title, message, type = 'info') {
  // Use existing toast system if available, otherwise simple alert
  if (window.showToast) {
    window.showToast(title, message, type);
  } else {
    console.log(`${type.toUpperCase()}: ${title} - ${message}`);
    // You could also create a simple toast notification here
  }
}

function getDefaultParticleSettings() {
  return {
    enabled: true,
    count: 50,
    shape: "circle",
    polygonSides: 5,
    starSides: 5,
    imageSource: "",
    colorMode: "single",
    particleColor: "#0066cc",
    colors: ["#0066cc"],
    size: 3,
    sizeRandom: false,
    opacity: 0.8,
    opacityRandom: false,
    moveEnable: true,
    moveSpeed: 1,
    moveType: "default",
    moveDirection: "none",
    moveOutMode: "out",
    moveAttract: false,
    attractRotateX: 600,
    attractRotateY: 1200,
    lineLinkedEnable: true,
    lineLinkedDistance: 150,
    lineLinkedColor: "#0066cc",
    lineLinkedOpacity: 0.6,
    lineLinkedWidth: 1,
    lineLinkedShadow: false,
    lineShadowColor: "#000000",
    lineShadowBlur: 5,
    detectOn: "canvas",
    clickMode: "push",
    resizeEnable: true,
    pushParticlesNb: 4,
    retinaDetect: true
  };
}

function applyParticleSettings(settings) {
  // Apply settings to particle system
  if (window.particleControls && window.particleControls.updateConfig) {
    // Debounce to avoid too frequent updates
    clearTimeout(window.particleUpdateTimeout);
    window.particleUpdateTimeout = setTimeout(() => {
      try {
        window.particleControls.updateConfig(settings);
      } catch (error) {
        console.warn('Error applying particle settings:', error);
      }
    }, 100);
  }
}

function updateAllSliderDisplays() {
  // Update all slider value displays
  const sliders = document.querySelectorAll('.config-slider');
  sliders.forEach(slider => {
    const valueDisplay = document.getElementById(`${slider.id}-value`);
    if (valueDisplay) {
      // Trigger display update
      slider.dispatchEvent(new Event('input'));
    }
  });
}

function resetToDefaults() {
  const defaults = getDefaultParticleSettings();
  applySettingsToControls(defaults);
  handleConfigChange();
}

async function initializeParticleSettings() {
  try {
    // Initialize particle database
    await initParticleDB();
    
    // Load saved settings or defaults
    const settings = await loadParticleSettings();
    
    // Set up particle controls when modal opens
    setupParticleControls();
    
    // Apply settings if particles are available
    applyParticleSettings(settings);
  } catch (error) {
    console.error('Failed to initialize particle settings:', error);
  }
}

function getControlId(key) {
  // Map settings keys to control element IDs
  const mapping = {
    enabled: 'particles-enabled',
    reducedMotion: 'reduced-motion',
    count: 'particle-count',
    shape: 'particle-shape',
    polygonSides: 'polygon-sides',
    starSides: 'star-sides',
    imageSource: 'image-source',
    colorMode: 'color-mode',
    particleColor: 'particle-color',
    size: 'particle-size',
    sizeRandom: 'size-random',
    sizeVariation: 'size-variation',
    opacity: 'particle-opacity',
    opacityRandom: 'opacity-random',
    opacityVariation: 'opacity-variation',
    moveEnable: 'move-enable',
    moveSpeed: 'move-speed',
    moveType: 'move-type',
    moveDirection: 'move-direction',
    moveOutMode: 'move-out-mode',
    moveAttract: 'move-attract',
    attractRotateX: 'attract-rotate-x',
    attractRotateY: 'attract-rotate-y',
    lineLinkedEnable: 'line-linked-enable',
    lineLinkedDistance: 'line-linked-distance',
    lineLinkedColor: 'line-linked-color',
    lineLinkedOpacity: 'line-linked-opacity',
    lineLinkedWidth: 'line-linked-width',
    lineLinkedShadow: 'line-linked-shadow',
    lineWarp: 'line-warp',
    lineTriangles: 'line-triangles',
    triangleColor: 'triangle-color',
    triangleOpacity: 'triangle-opacity',
    lineShadowColor: 'line-shadow-color',
    lineShadowBlur: 'line-shadow-blur',
    detectOn: 'detect-on',
    clickMode: 'click-mode',
    resizeEnable: 'resize-enable',
    pushParticlesNb: 'push-particles-nb',
    retinaDetect: 'retina-detect'
  };
  return mapping[key] || key;
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
  
  // Handle multiple colors
  if (settings.colorMode === 'multiple' && settings.colors) {
    setupMultipleColors(settings.colors);
  }
  
  // Update visibility and slider displays
  setTimeout(() => {
    updateVisibilityBasedOnSelections();
    updateAllSliderDisplays();
    
    // Manually trigger triangle controls visibility if triangles are enabled
    if (settings.lineTriangles) {
      const triangleControls = document.getElementById('triangle-controls');
      if (triangleControls) triangleControls.style.display = 'block';
    }
    
    // Manually trigger direction controls visibility if move type is straight
    if (settings.moveType === 'straight') {
      const directionRow = document.getElementById('direction-row');
      if (directionRow) directionRow.style.display = 'block';
    }
  }, 100);
}

function setupMultipleColors(colors) {
  const colorList = document.getElementById('color-list');
  if (!colorList) return;
  
  colorList.innerHTML = '';
  
  colors.forEach(color => {
    const colorItem = document.createElement('div');
    colorItem.className = 'color-item';
    colorItem.innerHTML = `
      <input type="color" value="${color}" class="config-color">
      <button type="button" class="color-remove-btn">Remove</button>
    `;
    
    const removeBtn = colorItem.querySelector('.color-remove-btn');
    removeBtn.addEventListener('click', () => {
      colorItem.remove();
      handleConfigChange();
    });
    
    const colorInput = colorItem.querySelector('input[type="color"]');
    colorInput.addEventListener('change', handleConfigChange);
    
    colorList.appendChild(colorItem);
  });
}

function applyPreset(presetName) {
  if (window.particleControls && window.particleControls.getPresets) {
    const presets = window.particleControls.getPresets();
    const preset = presets[presetName];
    
    if (preset) {
      try {
        const settings = convertPresetToSettings(preset);
        
        // Validate the preset settings
        const validation = validateParticleSettings(settings);
        if (!validation.isValid) {
          showToast('Preset Error', `Invalid preset "${presetName}": ${validation.errors[0]}`, 'error');
          return;
        }
        
        // Apply the validated preset
        applySettingsToControls(settings);
        handleConfigChange();
        
        showToast('Preset Applied', `"${presetName}" preset loaded successfully`, 'success');
      } catch (error) {
        showToast('Preset Error', `Failed to load preset "${presetName}"`, 'error');
        console.error('Preset loading error:', error);
      }
    } else {
      showToast('Preset Not Found', `Preset "${presetName}" does not exist`, 'error');
    }
  } else {
    showToast('System Error', 'Particle system not ready', 'error');
  }
}

function convertPresetToSettings(preset) {
  // Convert tsParticles config to our settings format
  const p = preset.particles;
  const i = preset.interactivity;
  
  // Handle color mode detection
  let colorMode = 'single';
  let particleColor = '#0066cc';
  let colors = ['#0066cc'];
  
  if (p.color?.value === 'random') {
    colorMode = 'random';
    particleColor = '#ff0000'; // Default base color for random mode
    colors = ['#ff0000']; // Will be ignored in random mode
  } else if (Array.isArray(p.color?.value)) {
    colorMode = 'multiple';
    particleColor = p.color.value[0];
    colors = p.color.value;
  } else {
    colorMode = 'single';
    particleColor = p.color?.value || '#0066cc';
    colors = [particleColor];
  }
  
  return {
    enabled: true,
    count: p.number?.value || 50,
    shape: p.shape?.type || 'circle',
    polygonSides: p.shape?.options?.polygon?.sides || p.shape?.polygon?.sides || 5,
    starSides: p.shape?.options?.star?.sides || p.shape?.polygon?.sides || 5,
    colorMode: colorMode,
    particleColor: particleColor,
    colors: colors,
    size: p.size?.value || 3,
    sizeRandom: p.size?.random || false,
    opacity: p.opacity?.value || 0.5,
    opacityRandom: p.opacity?.random || false,
    moveEnable: p.move?.enable !== false,
    moveSpeed: p.move?.speed || 1,
    moveType: p.move?.straight ? 'straight' : (p.move?.random ? 'random' : 'default'),
    moveDirection: p.move?.direction || 'none',
    moveOutMode: p.move?.outModes?.default || 'out',
    moveAttract: p.move?.attract?.enable || false,
    attractRotateX: p.move?.attract?.rotateX || 600,
    attractRotateY: p.move?.attract?.rotateY || 1200,
    lineLinkedEnable: p.links?.enable !== false,
    lineLinkedDistance: p.links?.distance || 150,
    lineLinkedColor: p.links?.color || '#0066cc',
    lineLinkedOpacity: p.links?.opacity || 0.4,
    lineLinkedWidth: p.links?.width || 1,
    lineTriangles: p.links?.triangles?.enable || false,
    triangleColor: p.links?.triangles?.color || '#0066cc',
    triangleOpacity: p.links?.triangles?.opacity || 0.5,
    lineShadowColor: p.links?.shadow?.color || '#000000',
    lineShadowBlur: p.links?.shadow?.blur || 5,
    lineLinkedShadow: p.links?.shadow?.enable || false,
    detectOn: i.detectsOn || 'canvas',
    clickMode: i.events?.onClick?.enable === false ? 'none' : (i.events?.onClick?.mode || 'push'),
    resizeEnable: i.events?.resize !== false,
    pushParticlesNb: i.modes?.push?.quantity || i.modes?.remove?.quantity || 4,
    retinaDetect: preset.retina_detect !== false && preset.detectRetina !== false
  };
}

// Custom modal functions
function showInputModal(title, message, defaultValue = '', onConfirm) {
  // Remove existing modal if present
  const existingModal = document.getElementById('custom-input-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'custom-input-modal';
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="custom-modal-content">
      <div class="custom-modal-header">
        <h3>${title}</h3>
      </div>
      <div class="custom-modal-body">
        <p>${message}</p>
        <input type="text" id="modal-input" value="${defaultValue}" class="modal-input" maxlength="50">
      </div>
      <div class="custom-modal-footer">
        <button type="button" class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
        <button type="button" class="modal-btn modal-btn-primary" id="modal-confirm">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = modal.querySelector('#modal-input');
  const confirmBtn = modal.querySelector('#modal-confirm');
  const cancelBtn = modal.querySelector('#modal-cancel');
  
  // Show modal
  setTimeout(() => modal.classList.add('active'), 10);
  
  // Focus and select input
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  
  const cleanup = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };
  
  confirmBtn.addEventListener('click', () => {
    const value = input.value.trim();
    if (value.length === 0) {
      input.focus();
      input.classList.add('error');
      setTimeout(() => input.classList.remove('error'), 2000);
      return;
    }
    cleanup();
    if (onConfirm) onConfirm(value);
  });
  
  cancelBtn.addEventListener('click', cleanup);
  
  // Enter key to confirm, Escape to cancel
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  });
  
  // Click outside to cancel
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup();
  });
}

function showConfirmModal(title, message, onConfirm) {
  // Remove existing modal if present
  const existingModal = document.getElementById('custom-confirm-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'custom-confirm-modal';
  modal.className = 'custom-modal';
  modal.innerHTML = `
    <div class="custom-modal-content">
      <div class="custom-modal-header">
        <h3>${title}</h3>
      </div>
      <div class="custom-modal-body">
        <p>${message}</p>
      </div>
      <div class="custom-modal-footer">
        <button type="button" class="modal-btn modal-btn-secondary" id="modal-cancel">Cancel</button>
        <button type="button" class="modal-btn modal-btn-danger" id="modal-confirm">Delete</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const confirmBtn = modal.querySelector('#modal-confirm');
  const cancelBtn = modal.querySelector('#modal-cancel');
  
  // Show modal
  setTimeout(() => modal.classList.add('active'), 10);
  
  // Focus on cancel button by default for safety
  setTimeout(() => cancelBtn.focus(), 100);
  
  const cleanup = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };
  
  confirmBtn.addEventListener('click', () => {
    cleanup();
    if (onConfirm) onConfirm();
  });
  
  cancelBtn.addEventListener('click', cleanup);
  
  // Escape key to cancel
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
  
  // Click outside to cancel
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup();
  });
}

// Import/Export functions
function exportConfiguration() {
  const settings = getCurrentSettings();
  const dataStr = JSON.stringify(settings, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `particle-config-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

function importConfiguration() {
  const fileInput = document.getElementById('config-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

function handleConfigImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const settings = JSON.parse(e.target.result);
      
      // Validate imported settings
      const validation = validateParticleSettings(settings);
      if (!validation.isValid) {
        showToast('Import Failed', `Invalid configuration: ${validation.errors[0]}`, 'error');
        return;
      }
      
      // Show warnings if any
      if (validation.warnings.length > 0) {
        showToast('Import Warning', validation.warnings[0], 'warning');
      }
      
      // Sanitize and apply settings
      const sanitizedSettings = sanitizeSettings(settings);
      applySettingsToControls(sanitizedSettings);
      handleConfigChange();
      
      showToast('Configuration Imported', 'Settings loaded successfully', 'success');
    } catch (error) {
      showToast('Import Error', 'Invalid configuration file format', 'error');
      console.error('Import error:', error);
    }
  };
  reader.readAsText(file);
}

// Custom preset management

async function loadCustomPresets() {
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readonly');
    const store = transaction.objectStore('presets');
    
    const presets = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    const keys = await new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    displayCustomPresets(keys, presets);
  } catch (error) {
    console.error('Failed to load custom presets:', error);
  }
}

function displayCustomPresets(names, presets) {
  const container = document.getElementById('custom-presets');
  if (!container) return;
  
  container.innerHTML = '';
  
  names.forEach((name, index) => {
    const presetItem = document.createElement('div');
    presetItem.className = 'custom-preset-item';
    
    presetItem.innerHTML = `
      <button class="custom-preset-btn" data-preset="${name}">${name}</button>
      <button class="custom-preset-delete" data-preset="${name}">×</button>
    `;
    
    const btn = presetItem.querySelector('.custom-preset-btn');
    btn.addEventListener('click', () => {
      console.log('Loading preset:', name, 'with data:', presets[index]);
      // Extract settings from the preset object structure
      const presetData = presets[index];
      const settings = presetData?.settings || presetData; // Handle both old and new formats
      console.log('Applying settings:', settings);
      applySettingsToControls(settings);
      handleConfigChange();
      showToast(`Loaded preset: ${name}`, 'success');
    });
    
    const deleteBtn = presetItem.querySelector('.custom-preset-delete');
    deleteBtn.addEventListener('click', () => deleteCustomPreset(name));
    
    container.appendChild(presetItem);
  });
}

async function deleteCustomPreset(name) {
  showConfirmModal(
    'Delete Preset', 
    `Are you sure you want to delete the preset "${name}"? This action cannot be undone.`,
    async () => {
      try {
        const db = await initParticleDB();
        const transaction = db.transaction(['presets'], 'readwrite');
        const store = transaction.objectStore('presets');
        
        await new Promise((resolve, reject) => {
          const request = store.delete(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        
        showToast(`Deleted preset: ${name}`, 'success');
        loadCustomPresets();
      } catch (error) {
        console.error('Failed to delete custom preset:', error);
        showToast('Failed to delete preset', 'error');
      }
    }
  );
}

// IndexedDB functions
async function initParticleDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoBankParticles', 3);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
      if (!db.objectStoreNames.contains('presets')) {
        db.createObjectStore('presets');
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

function applyParticleSettings(settings) {
  // Check if particle config modal is open
  const isParticleModalOpen = document.querySelector('#particle-config-modal:not(.hidden)');
  
  // Apply to particle system
  if (window.particleControls && window.particleControls.updateConfig) {
    if (isParticleModalOpen) {
      // Defer particle updates when modal is open to prevent visual interference
      clearTimeout(window.particleUpdateTimeout);
      window.particleUpdateTimeout = setTimeout(() => {
        window.particleControls.updateConfig(settings);
      }, 500);
    } else {
      window.particleControls.updateConfig(settings);
    }
  } else {
    // Store settings for when particle system loads
    window.pendingParticleSettings = settings;
  }
}

async function saveParticleSettings(settings) {
  if (!settings) {
    settings = getCurrentSettings();
  }
  
  try {
    if (window.particleControls && window.particleControls.saveSettings) {
      await window.particleControls.saveSettings(settings);
    }
  } catch (error) {
    console.error('Failed to save particle settings:', error);
  }
}

async function loadParticleSettings() {
  try {
    if (window.particleControls && window.particleControls.loadSettings) {
      const settings = await window.particleControls.loadSettings();
      if (settings) {
        applySettingsToControls(settings);
        // Load custom presets
        loadCustomPresets();
        return;
      }
    }
    
    // Fallback to defaults
    const defaults = getDefaultSettings();
    applySettingsToControls(defaults);
    loadCustomPresets();
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
    density: 800,
    shape: "circle",
    polygonSides: 5,
    starSides: 5,
    imageSource: "",
    strokeWidth: 0,
    strokeColor: "#000000",
    colorMode: "single",
    particleColor: "#0066cc",
    colors: ["#0066cc"],
    size: 3,
    sizeRandom: false,
    sizeAnim: false,
    sizeAnimSpeed: 40,
    sizeAnimMin: 0.1,
    sizeAnimSync: false,
    opacity: 0.5,
    opacityRandom: false,
    opacityAnim: false,
    opacityAnimSpeed: 1,
    opacityAnimMin: 0.1,
    opacityAnimSync: false,
    moveEnable: true,
    moveSpeed: 1,
    moveDirection: "none",
    moveRandom: false,
    moveStraight: false,
    moveOutMode: "bounce",
    moveBounce: false,
    moveAttract: false,
    attractRotateX: 600,
    attractRotateY: 1200,
    lineLinkedEnable: true,
    lineLinkedDistance: 150,
    lineLinkedColor: "#0066cc",
    lineLinkedOpacity: 0.4,
    lineLinkedWidth: 1,
    lineLinkedShadow: false,
    lineShadowColor: "#000000",
    lineShadowBlur: 5,
    detectOn: "canvas",
    hoverEnable: true,
    hoverMode: "grab",
    clickEnable: true,
    clickMode: "push",
    resizeEnable: true,
    grabDistance: 120,
    grabLineOpacity: 0.5,
    bubbleDistance: 100,
    bubbleSize: 10,
    bubbleDuration: 0.4,
    repulseDistance: 100,
    repulseDuration: 0.4,
    pushParticlesNb: 4,
    retinaDetect: true,
    backgroundColor: "",
    backgroundImage: "",
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
  };
}

function resetToDefaults() {
  const defaults = getDefaultSettings();
  applySettingsToControls(defaults);
  handleConfigChange();
}

function updateAllSliderDisplays() {
  const sliders = [
    { id: 'particle-count', suffix: '', precision: 0 },
    { id: 'particle-density', suffix: '', precision: 0 },
    { id: 'polygon-sides', suffix: '', precision: 0 },
    { id: 'star-sides', suffix: '', precision: 0 },
    { id: 'stroke-width', suffix: 'px', precision: 1 },
    { id: 'particle-size', suffix: 'px', precision: 1 },
    { id: 'size-variation', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'size-anim-speed', suffix: '', precision: 0 },
    { id: 'size-anim-min', suffix: 'px', precision: 1 },
    { id: 'particle-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'opacity-variation', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'opacity-anim-speed', suffix: '', precision: 1 },
    { id: 'opacity-anim-min', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'move-speed', suffix: '', precision: 1 },
    { id: 'attract-rotate-x', suffix: '', precision: 0 },
    { id: 'attract-rotate-y', suffix: '', precision: 0 },
    { id: 'line-linked-distance', suffix: 'px', precision: 0 },
    { id: 'line-linked-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'line-linked-width', suffix: 'px', precision: 1 },
    { id: 'line-shadow-blur', suffix: 'px', precision: 0 },
    { id: 'grab-distance', suffix: 'px', precision: 0 },
    { id: 'grab-line-opacity', suffix: '%', multiplier: 100, precision: 0 },
    { id: 'bubble-distance', suffix: 'px', precision: 0 },
    { id: 'bubble-size', suffix: 'px', precision: 0 },
    { id: 'bubble-duration', suffix: 's', precision: 1 },
    { id: 'repulse-distance', suffix: 'px', precision: 0 },
    { id: 'repulse-duration', suffix: 's', precision: 1 },
    { id: 'push-particles-nb', suffix: '', precision: 0 }
  ];
  
  sliders.forEach(({ id, suffix, multiplier = 1, precision = 1 }) => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    
    if (slider && valueDisplay) {
      const value = parseFloat(slider.value) * multiplier;
      const displayValue = precision === 0 ? Math.round(value) : value.toFixed(precision);
      valueDisplay.textContent = `${displayValue}${suffix}`;
    }
  });
}

async function initializeParticleSettings() {
  try {
    await loadParticleSettings();
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

// Reintroduced visibility management functions
function updateVisibilityBasedOnSelections() {
  // Shape-specific controls
  const shape = document.getElementById('particle-shape')?.value;
  const polygonRow = document.getElementById('polygon-sides-row');
  const starRow = document.getElementById('star-sides-row');
  const imageRow = document.getElementById('image-source-row');
  
  if (polygonRow) polygonRow.style.display = shape === 'polygon' ? 'block' : 'none';
  if (starRow) starRow.style.display = shape === 'star' ? 'block' : 'none';
  if (imageRow) imageRow.style.display = shape === 'image' ? 'block' : 'none';

  // Color mode controls
  const colorMode = document.getElementById('color-mode')?.value;
  const singleColorRow = document.getElementById('single-color-row');
  const multipleColorsSection = document.getElementById('multiple-colors-section');
  
  if (singleColorRow) singleColorRow.style.display = colorMode === 'single' ? 'block' : 'none';
  if (multipleColorsSection) multipleColorsSection.style.display = colorMode === 'multiple' ? 'block' : 'none';

  // Size controls
  const sizeRandom = document.getElementById('size-random')?.checked;
  const sizeRandomControls = document.getElementById('size-random-controls');
  if (sizeRandomControls) sizeRandomControls.style.display = sizeRandom ? 'block' : 'none';

  // Opacity controls
  const opacityRandom = document.getElementById('opacity-random')?.checked;
  const opacityRandomControls = document.getElementById('opacity-random-controls');
  if (opacityRandomControls) opacityRandomControls.style.display = opacityRandom ? 'block' : 'none';

  // Movement controls
  const moveEnable = document.getElementById('move-enable')?.checked;
  const movementControls = document.getElementById('movement-controls');
  if (movementControls) movementControls.style.display = moveEnable ? 'block' : 'none';

  // Movement type specific controls
  const moveType = document.getElementById('move-type')?.value;
  const directionRow = document.getElementById('direction-row');
  if (directionRow) directionRow.style.display = moveType === 'straight' ? 'block' : 'none';

  // Attract controls
  const moveAttract = document.getElementById('move-attract')?.checked;
  const attractControls = document.getElementById('attract-controls');
  if (attractControls) attractControls.style.display = moveAttract ? 'block' : 'none';

  // Line controls
  const lineEnable = document.getElementById('line-linked-enable')?.checked;
  const lineControls = document.getElementById('line-controls');
  if (lineControls) lineControls.style.display = lineEnable ? 'block' : 'none';

  const lineShadow = document.getElementById('line-linked-shadow')?.checked;
  const lineShadowControls = document.getElementById('line-shadow-controls');
  if (lineShadowControls) lineShadowControls.style.display = lineShadow ? 'block' : 'none';

  const lineTriangles = document.getElementById('line-triangles')?.checked;
  const triangleControls = document.getElementById('triangle-controls');
  if (triangleControls) triangleControls.style.display = lineTriangles ? 'block' : 'none';
}

function updateAllSliderDisplays() {
  const sliders = document.querySelectorAll('.config-slider');
  sliders.forEach(slider => {
    const evt = new Event('input');
    slider.dispatchEvent(evt);
  });
}

/* PWA manifest injection */
if (!document.querySelector('link[rel="manifest"]')) {
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = '/manifest.json';
  document.head.appendChild(l);
}