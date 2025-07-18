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
    
    // Clean up all timeouts
    clearTimeout(window.particleUpdateTimeout);
    
    // Apply any pending particle updates when modal closes
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
  // Add error boundary to prevent crashes
  try {
    // Basic checkboxes
    const checkboxes = [
      'particles-enabled', 'size-random', 'size-anim', 'size-anim-sync',
      'opacity-random', 'opacity-anim', 'opacity-anim-sync', 'move-enable',
      'move-random', 'move-straight', 'move-bounce', 'move-attract',
      'line-linked-enable', 'line-linked-shadow', 'hover-enable', 'click-enable',
      'resize-enable', 'retina-detect'
    ];
    
    checkboxes.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          try {
            handleConfigChange();
          } catch (error) {
            console.warn(`Error handling change for ${id}:`, error);
          }
        });
      }
    });
  
  // Sliders with value display and precision control
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
      const updateValue = () => {
        const value = parseFloat(slider.value) * multiplier;
        const displayValue = precision === 0 ? Math.round(value) : value.toFixed(precision);
        valueDisplay.textContent = `${displayValue}${suffix}`;
      };
      
      slider.addEventListener('input', updateValue);
      slider.addEventListener('change', () => {
        handleConfigChange();
      });
      
      // Make value display editable
      setupEditableValue(valueDisplay, slider, suffix, multiplier, precision);
      
      updateValue(); // Initialize display
    }
  });
  
  // Color inputs
  const colorInputs = [
    'particle-color', 'stroke-color', 'line-linked-color', 'line-shadow-color',
    'background-color'
  ];
  colorInputs.forEach(id => {
    const colorInput = document.getElementById(id);
    if (colorInput) {
      colorInput.addEventListener('change', () => {
        handleConfigChange();
      });
    }
  });
  
  // Select dropdowns
  const selects = [
    'particle-shape', 'color-mode', 'move-direction', 'move-out-mode',
    'detect-on', 'hover-mode', 'click-mode', 'background-repeat'
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
  
  // Text inputs
  const textInputs = [
    'image-source', 'background-image', 'background-position', 'background-size'
  ];
  textInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', () => {
        handleConfigChange();
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
  
  // Special buttons
  setupSpecialButtons();
  
  // Setup dynamic visibility
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
    
    const finishEdit = () => {
      let newValue = parseFloat(input.value);
      if (isNaN(newValue)) {
        newValue = parseFloat(slider.value) * multiplier;
      }
      
      // Clamp to valid range
      newValue = Math.max(min, Math.min(max, newValue));
      
      // Update slider value
      slider.value = newValue / multiplier;
      
      // Update display
      const finalDisplay = precision === 0 ? Math.round(newValue) : newValue.toFixed(precision);
      valueElement.textContent = `${finalDisplay}${suffix}`;
      
      input.parentNode.replaceChild(valueElement, input);
      handleConfigChange();
    };
    
    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      } else if (e.key === 'Escape') {
        input.parentNode.replaceChild(valueElement, input);
      }
    });
  });
}

function setupSpecialButtons() {
  // Add color button
  const addColorBtn = document.getElementById('add-color-btn');
  if (addColorBtn) {
    addColorBtn.addEventListener('click', addNewColor);
  }
  
  // Save preset button
  const savePresetBtn = document.getElementById('preset-save-btn');
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', showPresetSaveModal);
  }
  
  // Import/Export buttons
  const importBtn = document.getElementById('import-config-btn');
  const exportBtn = document.getElementById('export-config-btn');
  
  if (importBtn) {
    importBtn.addEventListener('click', importConfiguration);
  }
  
  if (exportBtn) {
    exportBtn.addEventListener('click', exportConfiguration);
  }
  
  // File input for import
  const fileInput = document.getElementById('config-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleConfigImport);
  }
  
  // Preset save modal buttons
  const saveConfirm = document.getElementById('preset-save-confirm');
  const saveCancel = document.getElementById('preset-save-cancel');
  
  if (saveConfirm) {
    saveConfirm.addEventListener('click', saveCustomPreset);
  }
  
  if (saveCancel) {
    saveCancel.addEventListener('click', hidePresetSaveModal);
  }
}

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
  
  const sizeAnim = document.getElementById('size-anim')?.checked;
  const sizeAnimControls = document.getElementById('size-anim-controls');
  if (sizeAnimControls) sizeAnimControls.style.display = sizeAnim ? 'block' : 'none';
  
  // Opacity controls
  const opacityRandom = document.getElementById('opacity-random')?.checked;
  const opacityRandomControls = document.getElementById('opacity-random-controls');
  if (opacityRandomControls) opacityRandomControls.style.display = opacityRandom ? 'block' : 'none';
  
  const opacityAnim = document.getElementById('opacity-anim')?.checked;
  const opacityAnimControls = document.getElementById('opacity-anim-controls');
  if (opacityAnimControls) opacityAnimControls.style.display = opacityAnim ? 'block' : 'none';
  
  // Movement controls
  const moveEnable = document.getElementById('move-enable')?.checked;
  const movementControls = document.getElementById('movement-controls');
  if (movementControls) movementControls.style.display = moveEnable ? 'block' : 'none';
  
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
  
  // Interaction controls
  const hoverEnable = document.getElementById('hover-enable')?.checked;
  const hoverControls = document.getElementById('hover-controls');
  if (hoverControls) hoverControls.style.display = hoverEnable ? 'block' : 'none';
  
  const clickEnable = document.getElementById('click-enable')?.checked;
  const clickControls = document.getElementById('click-controls');
  if (clickControls) clickControls.style.display = clickEnable ? 'block' : 'none';
}

function handleConfigChange() {
  const settings = getCurrentSettings();
  saveParticleSettings(settings);
  applyParticleSettings(settings);
}

function getCurrentSettings() {
  return {
    enabled: document.getElementById('particles-enabled')?.checked ?? true,
    count: parseInt(document.getElementById('particle-count')?.value ?? 50),
    density: parseInt(document.getElementById('particle-density')?.value ?? 800),
    shape: document.getElementById('particle-shape')?.value ?? 'circle',
    polygonSides: parseInt(document.getElementById('polygon-sides')?.value ?? 5),
    starSides: parseInt(document.getElementById('star-sides')?.value ?? 5),
    imageSource: document.getElementById('image-source')?.value ?? '',
    strokeWidth: parseFloat(document.getElementById('stroke-width')?.value ?? 0),
    strokeColor: document.getElementById('stroke-color')?.value ?? '#000000',
    colorMode: document.getElementById('color-mode')?.value ?? 'single',
    particleColor: document.getElementById('particle-color')?.value ?? '#0066cc',
    colors: getMultipleColors(),
    size: parseFloat(document.getElementById('particle-size')?.value ?? 3),
    sizeRandom: document.getElementById('size-random')?.checked ?? false,
    sizeAnim: document.getElementById('size-anim')?.checked ?? false,
    sizeAnimSpeed: parseFloat(document.getElementById('size-anim-speed')?.value ?? 40),
    sizeAnimMin: parseFloat(document.getElementById('size-anim-min')?.value ?? 0.1),
    sizeAnimSync: document.getElementById('size-anim-sync')?.checked ?? false,
    opacity: parseFloat(document.getElementById('particle-opacity')?.value ?? 0.5),
    opacityRandom: document.getElementById('opacity-random')?.checked ?? false,
    opacityAnim: document.getElementById('opacity-anim')?.checked ?? false,
    opacityAnimSpeed: parseFloat(document.getElementById('opacity-anim-speed')?.value ?? 1),
    opacityAnimMin: parseFloat(document.getElementById('opacity-anim-min')?.value ?? 0.1),
    opacityAnimSync: document.getElementById('opacity-anim-sync')?.checked ?? false,
    moveEnable: document.getElementById('move-enable')?.checked ?? true,
    moveSpeed: parseFloat(document.getElementById('move-speed')?.value ?? 1),
    moveDirection: document.getElementById('move-direction')?.value ?? 'none',
    moveRandom: document.getElementById('move-random')?.checked ?? false,
    moveStraight: document.getElementById('move-straight')?.checked ?? false,
    moveOutMode: document.getElementById('move-out-mode')?.value ?? 'bounce',
    moveBounce: document.getElementById('move-bounce')?.checked ?? false,
    moveAttract: document.getElementById('move-attract')?.checked ?? false,
    attractRotateX: parseFloat(document.getElementById('attract-rotate-x')?.value ?? 600),
    attractRotateY: parseFloat(document.getElementById('attract-rotate-y')?.value ?? 1200),
    lineLinkedEnable: document.getElementById('line-linked-enable')?.checked ?? true,
    lineLinkedDistance: parseFloat(document.getElementById('line-linked-distance')?.value ?? 150),
    lineLinkedColor: document.getElementById('line-linked-color')?.value ?? '#0066cc',
    lineLinkedOpacity: parseFloat(document.getElementById('line-linked-opacity')?.value ?? 0.4),
    lineLinkedWidth: parseFloat(document.getElementById('line-linked-width')?.value ?? 1),
    lineLinkedShadow: document.getElementById('line-linked-shadow')?.checked ?? false,
    lineShadowColor: document.getElementById('line-shadow-color')?.value ?? '#000000',
    lineShadowBlur: parseFloat(document.getElementById('line-shadow-blur')?.value ?? 5),
    detectOn: document.getElementById('detect-on')?.value ?? 'canvas',
    hoverEnable: document.getElementById('hover-enable')?.checked ?? true,
    hoverMode: document.getElementById('hover-mode')?.value ?? 'grab',
    clickEnable: document.getElementById('click-enable')?.checked ?? true,
    clickMode: document.getElementById('click-mode')?.value ?? 'push',
    resizeEnable: document.getElementById('resize-enable')?.checked ?? true,
    grabDistance: parseFloat(document.getElementById('grab-distance')?.value ?? 120),
    grabLineOpacity: parseFloat(document.getElementById('grab-line-opacity')?.value ?? 0.5),
    bubbleDistance: parseFloat(document.getElementById('bubble-distance')?.value ?? 100),
    bubbleSize: parseFloat(document.getElementById('bubble-size')?.value ?? 10),
    bubbleDuration: parseFloat(document.getElementById('bubble-duration')?.value ?? 0.4),
    repulseDistance: parseFloat(document.getElementById('repulse-distance')?.value ?? 100),
    repulseDuration: parseFloat(document.getElementById('repulse-duration')?.value ?? 0.4),
    pushParticlesNb: parseInt(document.getElementById('push-particles-nb')?.value ?? 4),
    retinaDetect: document.getElementById('retina-detect')?.checked ?? true,
    backgroundColor: document.getElementById('background-color')?.value ?? '',
    backgroundImage: document.getElementById('background-image')?.value ?? '',
    backgroundPosition: document.getElementById('background-position')?.value ?? 'center center',
    backgroundRepeat: document.getElementById('background-repeat')?.value ?? 'no-repeat',
    backgroundSize: document.getElementById('background-size')?.value ?? 'cover'
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
      const settings = convertPresetToSettings(preset);
      applySettingsToControls(settings);
      handleConfigChange();
    }
  }
}

function convertPresetToSettings(preset) {
  // Convert particles.js config to our settings format
  const p = preset.particles;
  const i = preset.interactivity;
  
  return {
    enabled: true,
    count: p.number?.value || 50,
    density: p.number?.density?.value_area || 800,
    shape: p.shape?.type || 'circle',
    polygonSides: p.shape?.polygon?.nb_sides || 5,
    starSides: p.shape?.polygon?.nb_sides || 5,
    strokeWidth: p.shape?.stroke?.width || 0,
    strokeColor: p.shape?.stroke?.color || '#000000',
    colorMode: Array.isArray(p.color?.value) ? 'multiple' : 'single',
    particleColor: Array.isArray(p.color?.value) ? p.color.value[0] : p.color?.value || '#0066cc',
    colors: Array.isArray(p.color?.value) ? p.color.value : ['#0066cc'],
    size: p.size?.value || 3,
    sizeRandom: p.size?.random || false,
    sizeAnim: p.size?.anim?.enable || false,
    sizeAnimSpeed: p.size?.anim?.speed || 40,
    sizeAnimMin: p.size?.anim?.size_min || 0.1,
    sizeAnimSync: p.size?.anim?.sync || false,
    opacity: p.opacity?.value || 0.5,
    opacityRandom: p.opacity?.random || false,
    opacityAnim: p.opacity?.anim?.enable || false,
    opacityAnimSpeed: p.opacity?.anim?.speed || 1,
    opacityAnimMin: p.opacity?.anim?.opacity_min || 0.1,
    opacityAnimSync: p.opacity?.anim?.sync || false,
    moveEnable: p.move?.enable !== false,
    moveSpeed: p.move?.speed || 1,
    moveDirection: p.move?.direction || 'none',
    moveRandom: p.move?.random || false,
    moveStraight: p.move?.straight || false,
    moveOutMode: p.move?.out_mode || 'bounce',
    moveBounce: p.move?.bounce || false,
    moveAttract: p.move?.attract?.enable || false,
    attractRotateX: p.move?.attract?.rotateX || 600,
    attractRotateY: p.move?.attract?.rotateY || 1200,
    lineLinkedEnable: p.line_linked?.enable !== false,
    lineLinkedDistance: p.line_linked?.distance || 150,
    lineLinkedColor: p.line_linked?.color || '#0066cc',
    lineLinkedOpacity: p.line_linked?.opacity || 0.4,
    lineLinkedWidth: p.line_linked?.width || 1,
    detectOn: i.detect_on || 'canvas',
    hoverEnable: i.events?.onhover?.enable !== false,
    hoverMode: i.events?.onhover?.mode || 'grab',
    clickEnable: i.events?.onclick?.enable !== false,
    clickMode: i.events?.onclick?.mode || 'push',
    resizeEnable: i.events?.resize !== false,
    grabDistance: i.modes?.grab?.distance || 120,
    grabLineOpacity: i.modes?.grab?.line_linked?.opacity || 0.5,
    bubbleDistance: i.modes?.bubble?.distance || 100,
    bubbleSize: i.modes?.bubble?.size || 10,
    bubbleDuration: i.modes?.bubble?.duration || 0.4,
    repulseDistance: i.modes?.repulse?.distance || 100,
    repulseDuration: i.modes?.repulse?.duration || 0.4,
    pushParticlesNb: i.modes?.push?.particles_nb || 4,
    retinaDetect: preset.retina_detect !== false,
    backgroundColor: preset.background?.color || '',
    backgroundImage: preset.background?.image || ''
  };
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
      applySettingsToControls(settings);
      handleConfigChange();
    } catch (error) {
      alert('Invalid configuration file. Please check the file format.');
      console.error('Import error:', error);
    }
  };
  reader.readAsText(file);
}

// Custom preset management
function showPresetSaveModal() {
  const modal = document.getElementById('preset-save-modal');
  const input = document.getElementById('preset-name-input');
  if (modal && input) {
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
  }
}

function hidePresetSaveModal() {
  const modal = document.getElementById('preset-save-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function saveCustomPreset() {
  const nameInput = document.getElementById('preset-name-input');
  const name = nameInput?.value?.trim();
  
  if (!name) {
    alert('Please enter a preset name.');
    return;
  }
  
  const settings = getCurrentSettings();
  
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readwrite');
    const store = transaction.objectStore('presets');
    
    await new Promise((resolve, reject) => {
      const request = store.put(settings, name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    hidePresetSaveModal();
    loadCustomPresets();
  } catch (error) {
    console.error('Failed to save custom preset:', error);
    alert('Failed to save preset. Please try again.');
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
      applySettingsToControls(presets[index]);
      handleConfigChange();
    });
    
    const deleteBtn = presetItem.querySelector('.custom-preset-delete');
    deleteBtn.addEventListener('click', () => deleteCustomPreset(name));
    
    container.appendChild(presetItem);
  });
}

async function deleteCustomPreset(name) {
  if (!confirm(`Delete preset "${name}"?`)) return;
  
  try {
    const db = await initParticleDB();
    const transaction = db.transaction(['presets'], 'readwrite');
    const store = transaction.objectStore('presets');
    
    await new Promise((resolve, reject) => {
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    loadCustomPresets();
  } catch (error) {
    console.error('Failed to delete custom preset:', error);
  }
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
    backgroundSize: "cover"
  };
}

function getControlId(settingKey) {
  const mapping = {
    enabled: 'particles-enabled',
    count: 'particle-count',
    density: 'particle-density',
    shape: 'particle-shape',
    polygonSides: 'polygon-sides',
    starSides: 'star-sides',
    imageSource: 'image-source',
    strokeWidth: 'stroke-width',
    strokeColor: 'stroke-color',
    colorMode: 'color-mode',
    particleColor: 'particle-color',
    size: 'particle-size',
    sizeRandom: 'size-random',
    sizeVariation: 'size-variation',
    sizeAnim: 'size-anim',
    sizeAnimSpeed: 'size-anim-speed',
    sizeAnimMin: 'size-anim-min',
    sizeAnimSync: 'size-anim-sync',
    opacity: 'particle-opacity',
    opacityRandom: 'opacity-random',
    opacityVariation: 'opacity-variation',
    opacityAnim: 'opacity-anim',
    opacityAnimSpeed: 'opacity-anim-speed',
    opacityAnimMin: 'opacity-anim-min',
    opacityAnimSync: 'opacity-anim-sync',
    moveEnable: 'move-enable',
    moveSpeed: 'move-speed',
    moveDirection: 'move-direction',
    moveRandom: 'move-random',
    moveStraight: 'move-straight',
    moveOutMode: 'move-out-mode',
    moveBounce: 'move-bounce',
    moveAttract: 'move-attract',
    attractRotateX: 'attract-rotate-x',
    attractRotateY: 'attract-rotate-y',
    lineLinkedEnable: 'line-linked-enable',
    lineLinkedDistance: 'line-linked-distance',
    lineLinkedColor: 'line-linked-color',
    lineLinkedOpacity: 'line-linked-opacity',
    lineLinkedWidth: 'line-linked-width',
    lineLinkedShadow: 'line-linked-shadow',
    lineShadowColor: 'line-shadow-color',
    lineShadowBlur: 'line-shadow-blur',
    detectOn: 'detect-on',
    hoverEnable: 'hover-enable',
    hoverMode: 'hover-mode',
    clickEnable: 'click-enable',
    clickMode: 'click-mode',
    resizeEnable: 'resize-enable',
    grabDistance: 'grab-distance',
    grabLineOpacity: 'grab-line-opacity',
    bubbleDistance: 'bubble-distance',
    bubbleSize: 'bubble-size',
    bubbleDuration: 'bubble-duration',
    repulseDistance: 'repulse-distance',
    repulseDuration: 'repulse-duration',
    pushParticlesNb: 'push-particles-nb',
    retinaDetect: 'retina-detect',
    backgroundColor: 'background-color',
    backgroundImage: 'background-image',
    backgroundPosition: 'background-position',
    backgroundRepeat: 'background-repeat',
    backgroundSize: 'background-size'
  };
  return mapping[settingKey] || settingKey;
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

/* PWA manifest injection */
if (!document.querySelector('link[rel="manifest"]')) {
  const l = document.createElement('link');
  l.rel = 'manifest';
  l.href = '/manifest.json';
  document.head.appendChild(l);
}