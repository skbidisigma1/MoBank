const STORE_CACHE_KEY = '__mobank_store_catalog';
const STORE_ORDERS_CACHE_KEY = '__mobank_store_orders';
const STORE_ADMIN_CATALOG_CACHE_KEY = '__mobank_store_admin_catalog';
const STORE_CACHE_MAX_AGE = 30 * 1000; // 30 seconds
const STORE_CART_MAX_ITEMS = 20;

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const state = {
  catalog: [],
  catalogIndex: new Map(),
  filtered: [],
  cart: new Map(),
  user: null,
  balance: 0,
  searchTerm: '',
    sortOption: 'new'
};

const deepClone = value => (typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)));

const selectors = {
  balanceValue: () => document.getElementById('store-balance-amount'),
  catalogGrid: () => document.getElementById('catalog-grid'),
  searchInput: () => document.getElementById('catalog-search-input'),
  sortSelect: () => document.getElementById('catalog-sort'),
  cartContainer: () => document.getElementById('cart-items'),
  cartSubtotal: () => document.getElementById('cart-subtotal'),
  cartRemaining: () => document.getElementById('cart-remaining'),
  cartCheckout: () => document.getElementById('cart-checkout'),
  cartClear: () => document.getElementById('cart-clear')
};

const periodNames = {
  4: 'Period 4',
  5: 'Period 5',
  6: 'Period 6',
  7: 'Period 7',
  8: 'Symphonic',
  10: 'Chamber'
};

// auth helpers
async function ensureAuthenticated() {
  await window.auth0Promise;
  const loggedIn = await isAuthenticated();
  if (!loggedIn) {
    window.location.href = 'login';
    return false;
  }
  return true;
}

async function getToken() {
  const cached = CACHE.read(CACHE.TOKEN_KEY);
  if (cached && cached.token && Date.now() - cached.timestamp < CACHE.TOKEN_MAX_AGE) {
    return cached.token;
  }
  try {
    const token = await auth0Client.getTokenSilently();
    CACHE.write(CACHE.TOKEN_KEY, { token, timestamp: Date.now() }, CACHE.TOKEN_MAX_AGE);
    return token;
  } catch (err) {
    console.error('MoStore: Failed to get token silently', err);
    await signInWithAuth0();
    throw err;
  }
}

async function fetchUserProfile() {
  try {
    const token = await getToken();
    const res = await fetch('/api/getUserData', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Profile fetch failed: ${res.status}`);
    }
    const data = await res.json();
    CACHE.write(CACHE.USER_KEY, data, CACHE.USER_MAX_AGE);
    return data;
  } catch (error) {
    console.error('MoStore: fetchUserProfile failed', error);
    throw error;
  }
}

async function getUserProfile({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = CACHE.read(CACHE.USER_KEY);
    if (cached) return cached;
    if (window.userDataPromise) {
      try {
        const fromPromise = await window.userDataPromise;
        if (fromPromise) {
          CACHE.write(CACHE.USER_KEY, fromPromise, CACHE.USER_MAX_AGE);
          return fromPromise;
        }
      } catch (err) {
        console.warn('MoStore: userDataPromise rejected', err);
      }
    }
  }
  return fetchUserProfile();
}

async function loadCatalog({ forceRefresh = false } = {}) {
  const cached = CACHE.read(STORE_CACHE_KEY);
  
  // If not forcing refresh and cache is valid, return immediately
  if (!forceRefresh && cached && cached.items && Array.isArray(cached.items)) {
    return cached;
  }
  
  // If forcing refresh but cache exists (stale), return it immediately
  // and update with fresh data in background
  if (forceRefresh && cached && cached.items) {
    // Return stale data immediately for instant display
    const staleData = cached;
    
    // Fetch fresh data in background
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/getCatalog', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const freshData = await res.json();
          CACHE.write(STORE_CACHE_KEY, freshData, STORE_CACHE_MAX_AGE);
          
          // Update state with fresh data
          state.catalog = freshData.items || [];
          buildCatalogIndex(state.catalog);
          applyFilters();
        }
      } catch (err) {
        console.warn('Background catalog refresh failed:', err);
      }
    })();
    
    return staleData;
  }
  
  // No cache - fetch fresh data
  try {
    const token = await getToken();
    const res = await fetch('/api/getCatalog', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error(`Catalog fetch failed: ${res.status}`);
    }
    
    const payload = await res.json();
    CACHE.write(STORE_CACHE_KEY, payload, STORE_CACHE_MAX_AGE);
    return payload;
  } catch (error) {
    console.error('loadCatalog error:', error);
    const stale = CACHE.read(STORE_CACHE_KEY);
    if (stale && stale.items) {
      console.warn('loadCatalog: using stale cache as fallback');
      return stale;
    }
    throw error;
  }
}

// rendering helpers
function renderBalance() {
  const balanceEl = selectors.balanceValue();
  if (!balanceEl) return;
  const balance = Number(state.balance || 0);
  const formatted = formatMoBucks(balance, { absolute: false });
  balanceEl.innerHTML = formatted;
}

function buildCatalogIndex(items) {
  state.catalogIndex.clear();
  items.forEach(item => {
    state.catalogIndex.set(item.id, item);
  });
}

function applyFilters() {
  const normalizedSearch = state.searchTerm.trim().toLowerCase();
  const adjusted = state.catalog.filter(item => {
    if (!normalizedSearch) return true;
    const fields = [item.name, item.description, ...(item.tags || [])].join(' ').toLowerCase();
    return fields.includes(normalizedSearch);
  });

  const sorted = sortItems(adjusted, state.sortOption);
  state.filtered = sorted;
  renderCatalog();
}

function sortItems(list, method) {
  const arr = [...list];
  switch (method) {
    case 'price-low':
      return arr.sort((a, b) => a.price - b.price);
    case 'price-high':
      return arr.sort((a, b) => b.price - a.price);
    case 'new':
    default:
      return arr.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function renderCatalog() {
  const grid = selectors.catalogGrid();
  if (!grid) {
    console.warn('renderCatalog: grid element not found');
    return;
  }

  grid.innerHTML = '';

  if (!state.filtered.length) {
    grid.innerHTML = '<p class="catalog-no-results">No items match your search.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'catalog-card';
    card.dataset.itemId = item.id;

    const stockLabel = item.stock == null ? 'Unlimited' : `${item.stock} left`;
    const isSoldOut = item.stock === 0;

    const title = document.createElement('h3');
    title.className = 'catalog-card__title';
    title.textContent = item.name;

    const description = document.createElement('p');
    description.className = 'catalog-card__description';
    description.textContent = item.description;

    const meta = document.createElement('div');
    meta.className = 'catalog-card__meta';
    
    const price = document.createElement('span');
    price.className = 'catalog-card__price';
    price.innerHTML = formatMoBucks(item.price, { absolute: true });
    
    const stock = document.createElement('span');
    stock.className = `catalog-card__stock ${isSoldOut ? 'sold-out' : ''}`;
    stock.textContent = isSoldOut ? 'Sold Out' : stockLabel;
    
    meta.appendChild(price);
    meta.appendChild(stock);

    const button = document.createElement('button');
    button.className = 'primary-button';
    button.setAttribute('data-action', 'add-to-cart');
    button.textContent = isSoldOut ? 'Sold Out' : 'Add to cart';
    if (isSoldOut) button.disabled = true;

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(meta);
    card.appendChild(button);

    fragment.appendChild(card);
  });

  grid.appendChild(fragment);
}

function renderCart() {
  const container = selectors.cartContainer();
  if (!container) return;

  container.innerHTML = '';
  if (!state.cart.size) {
    container.innerHTML = '<p class="cart-empty">Add something from the catalog to get started.</p>';
    updateCartSummary();
    return;
  }

  const frag = document.createDocumentFragment();
  let subtotal = 0;
  state.cart.forEach(({ item, quantity }) => {
    subtotal += item.price * quantity;
  });
  const remaining = (Number(state.balance) || 0) - subtotal;
  
  state.cart.forEach(({ item, quantity }) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.itemId = item.id;
    
    const canIncrement = (
      (item.stock === null || quantity < item.stock) &&
      (item.maxPerUser === null || quantity < item.maxPerUser) &&
      (remaining >= item.price)
    );
    
    row.innerHTML = `
      <div>
        <p class="cart-item__name">${item.name}</p>
        <p class="cart-item__details">${formatMoBucks(item.price, { absolute: true })} · ${quantity} ${quantity === 1 ? 'unit' : 'units'}</p>
      </div>
      <div class="cart-item__actions">
        <div class="cart-quantity" role="group" aria-label="Quantity controls" data-item-id="${item.id}">
          <button type="button" data-action="decrement" aria-label="Decrease quantity">−</button>
          <span class="cart-quantity-value" data-action="edit-quantity">${quantity}</span>
          <button type="button" data-action="increment" aria-label="Increase quantity" ${!canIncrement ? 'disabled' : ''}>+</button>
        </div>
        <button type="button" class="cart-remove" data-action="remove">Remove</button>
      </div>
    `;
    frag.appendChild(row);
  });

  container.appendChild(frag);
  updateCartSummary();
}

function updateCartSummary() {
  const subtotalEl = selectors.cartSubtotal();
  const remainingEl = selectors.cartRemaining();
  const checkoutBtn = selectors.cartCheckout();
  if (!subtotalEl || !remainingEl || !checkoutBtn) return;

  let subtotal = 0;
  state.cart.forEach(({ item, quantity }) => {
    subtotal += item.price * quantity;
  });

  subtotalEl.innerHTML = formatMoBucks(subtotal, { absolute: true });
  const remaining = (Number(state.balance) || 0) - subtotal;
  const formattedRemaining = formatMoBucks(remaining, { absolute: false });
  remainingEl.innerHTML = formattedRemaining;
  remainingEl.style.color = remaining < 0 ? '#fca5a5' : '';

  checkoutBtn.disabled = !state.cart.size || remaining < 0;
}

function addToCart(itemId) {
  if (state.cart.size >= STORE_CART_MAX_ITEMS && !state.cart.has(itemId)) {
    showToast('Cart full', 'You can only have 20 unique items in your cart at once.', 'warning');
    return;
  }

  const item = state.catalogIndex.get(itemId);
  if (!item) {
    showToast('Not available', 'This item is no longer available.', 'warning');
    return;
  }
  if (item.stock === 0) {
    showToast('Sold out', 'Sorry, this item is sold out.', 'warning');
    return;
  }

  const current = state.cart.get(itemId) || { item, quantity: 0 };
  const nextQty = current.quantity + 1;
  if (item.stock != null && nextQty > item.stock) {
    showToast('Inventory limit', 'You cannot add more than the remaining stock for this item.', 'danger');
    return;
  }
  if (item.maxPerUser != null && nextQty > item.maxPerUser) {
    showToast('Limit reached', 'Per-user limit reached for this item.', 'danger');
    return;
  }

  state.cart.set(itemId, { item, quantity: nextQty });
  renderCart();
  showToast('Added to cart', `${item.name} added successfully.`);
}

function removeFromCart(itemId) {
  state.cart.delete(itemId);
  renderCart();
}

function updateCartQuantity(itemId, delta) {
  const entry = state.cart.get(itemId);
  if (!entry) return;
  const nextQty = entry.quantity + delta;
  if (nextQty <= 0) {
    removeFromCart(itemId);
    return;
  }
  if (entry.item.stock != null && nextQty > entry.item.stock) {
    showToast('Inventory limit', 'No more stock available for this item.', 'danger');
    return;
  }
  if (entry.item.maxPerUser != null && nextQty > entry.item.maxPerUser) {
    showToast('Limit reached', 'Per-user limit reached for this item.', 'danger');
    return;
  }
  state.cart.set(itemId, { item: entry.item, quantity: nextQty });
  renderCart();
}

function clearCart() {
  state.cart.clear();
  renderCart();
}

function wireCatalogEvents() {
  if (window._catalogEventsWired) return;
  window._catalogEventsWired = true;
  
  document.addEventListener('click', function(evt) {
    const button = evt.target;
    if (!button.hasAttribute || !button.hasAttribute('data-action')) return;
    if (button.getAttribute('data-action') !== 'add-to-cart') return;
    
    const card = button.closest('.catalog-card');
    if (!card) return;
    
    const itemId = card.dataset.itemId;
    if (!itemId) return;

    evt.preventDefault();
    evt.stopPropagation();
    addToCart(itemId);
  }, true);
}

function wireCartEvents() {
  const container = selectors.cartContainer();
  container?.addEventListener('click', evt => {
    const target = evt.target.closest('[data-action]');
    if (!target) return;
    const itemRow = evt.target.closest('.cart-item');
    if (!itemRow) return;
    const itemId = itemRow.dataset.itemId;
    if (!itemId) return;

    switch (target.dataset.action) {
      case 'remove':
        removeFromCart(itemId);
        break;
      case 'increment':
        updateCartQuantity(itemId, 1);
        break;
      case 'decrement':
        updateCartQuantity(itemId, -1);
        break;
      case 'edit-quantity':
        editCartQuantity(itemId, target);
        break;
      default:
        break;
    }
  });
}

function editCartQuantity(itemId, spanElement) {
  const entry = state.cart.get(itemId);
  if (!entry) return;
  
  const currentQty = entry.quantity;
  const maxQty = Math.min(
    entry.item.stock === null ? 999 : entry.item.stock,
    entry.item.maxPerUser === null ? 999 : entry.item.maxPerUser
  );
  
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.max = maxQty.toString();
  input.value = currentQty.toString();
  input.className = 'cart-quantity-input';
  
  spanElement.replaceWith(input);
  input.focus();
  input.select();
  
  const finishEdit = () => {
    const newQty = parseInt(input.value, 10);
    if (!isNaN(newQty) && newQty >= 1 && newQty <= maxQty && newQty !== currentQty) {
      const entry = state.cart.get(itemId);
      if (entry) {
        state.cart.set(itemId, { item: entry.item, quantity: newQty });
      }
    }
    renderCart();
  };
  
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', evt => {
    if (evt.key === 'Enter') {
      finishEdit();
    } else if (evt.key === 'Escape') {
      renderCart();
    }
  });
}

function wireCatalogControls() {
  const sortSelect = selectors.sortSelect();
  if (sortSelect) {
    sortSelect.value = state.sortOption;
  }

  const debouncedFilter = debounce(() => {
    applyFilters();
  }, 300);

  selectors.searchInput()?.addEventListener('input', evt => {
    state.searchTerm = evt.target.value;
    debouncedFilter();
  });

  sortSelect?.addEventListener('change', evt => {
    state.sortOption = evt.target.value;
    applyFilters();
  });
}

function wireCartActions() {
  selectors.cartClear()?.addEventListener('click', () => {
    if (!state.cart.size) return;
    clearCart();
    showToast('Cart cleared', 'Your cart is now empty.');
  });

  selectors.cartCheckout()?.addEventListener('click', () => {
    if (!state.cart.size) return;
    handleCheckout();
  });
}

function renderUserContext(profile) {
  const balancePanel = document.getElementById('store-balance-panel');
  if (!balancePanel) return;
  const subtitle = balancePanel.querySelector('.balance-label');
  if (subtitle && profile.class_period != null) {
    subtitle.innerHTML = `Your MoBuck Balance`;
  }
}

async function handleCheckout() {
  if (!state.cart.size) return;
  
  const subtotal = Array.from(state.cart.values()).reduce((sum, { item, quantity }) => {
    return sum + (item.price * quantity);
  }, 0);
  
  if (subtotal > state.balance) {
    showToast('Insufficient balance', 'You\'re too broke to afford this item.', 'danger');
    return;
  }
  if (!state.cart.size) return;
  
  const checkoutBtn = selectors.cartCheckout();
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Processing...';
  }
  
  try {
    const token = await getToken();
    const items = Array.from(state.cart.values()).map(({ item, quantity }) => ({
      id: item.id,
      quantity
    }));
    
    const res = await fetch('/api/submitOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ items })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Order failed: ${res.status}`);
    }
    
    const result = await res.json();
    
    // update local balance
    state.balance = result.newBalance;
    renderBalance();
    
    clearCart();
    
    // invalidate all caches
    CACHE.remove(STORE_CACHE_KEY);
    CACHE.remove(STORE_ADMIN_CATALOG_CACHE_KEY);
    CACHE.remove(STORE_ORDERS_CACHE_KEY);
    
    // force refresh catalog
    try {
      const catalogPayload = await loadCatalog({ forceRefresh: true });
      state.catalog = catalogPayload.items || [];
      buildCatalogIndex(state.catalog);
      applyFilters();
    } catch (err) {
      console.warn('Failed to refresh catalog after checkout', err);
    }
    
    // refresh orders
    try {
      await loadMyOrders();
    } catch (err) {
      console.warn('Failed to refresh orders after checkout', err);
    }
    
    showToast('Order placed!', `Your order for ${formatMoBucksPlain(result.total)} is pending fulfillment.`, 'success');
    
  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Checkout failed', error.message || 'Could not complete your order.', 'danger');
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Checkout';
    }
  }
}

// modal helpers
function showConfirmModal(title, message, onConfirm, confirmText = 'Confirm', confirmStyle = 'primary') {
  const existingModal = document.getElementById('store-confirm-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'store-confirm-modal';
  modal.className = 'confirmation-modal-overlay';
  modal.innerHTML = `
    <div class="confirmation-modal">
      <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--color-text);">${title}</h3>
      <p class="confirmation-modal-message">${message}</p>
      <div class="confirmation-modal-buttons">
        <button type="button" class="secondary-button" id="modal-cancel">Cancel</button>
        <button type="button" class="${confirmStyle}-button" id="modal-confirm">${confirmText}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const confirmBtn = modal.querySelector('#modal-confirm');
  const cancelBtn = modal.querySelector('#modal-cancel');
  
  setTimeout(() => modal.classList.add('active'), 10);
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
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup();
  });
  
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
}

function showDeclineModal(orderId, userId) {
  const existingModal = document.getElementById('store-decline-modal');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'store-decline-modal';
  modal.className = 'confirmation-modal-overlay';
  modal.innerHTML = `
    <div class="confirmation-modal" style="max-width: 500px;">
      <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--color-text);">Decline Order</h3>
      <p class="confirmation-modal-message">The student will be refunded and notified. You can optionally provide a reason:</p>
      <textarea id="decline-reason" placeholder="Reason for declining (optional)" style="width: 100%; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-main-bg); color: var(--color-text); font-family: inherit; resize: vertical; min-height: 80px; margin-bottom: 1rem;"></textarea>
      <div class="confirmation-modal-buttons">
        <button type="button" class="secondary-button" id="modal-cancel">Cancel</button>
        <button type="button" class="danger-button" id="modal-confirm">Decline Order</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const confirmBtn = modal.querySelector('#modal-confirm');
  const cancelBtn = modal.querySelector('#modal-cancel');
  const reasonInput = modal.querySelector('#decline-reason');
  
  setTimeout(() => modal.classList.add('active'), 10);
  setTimeout(() => reasonInput.focus(), 100);
  
  const cleanup = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  };
  
  confirmBtn.addEventListener('click', () => {
    const reason = reasonInput.value.trim();
    cleanup();
    declineOrderClick(orderId, userId, reason);
  });
  
  cancelBtn.addEventListener('click', cleanup);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup();
  });
  
  document.addEventListener('keydown', function escapeHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escapeHandler);
    }
  });
}

// admin functions
let isAdmin = false;
let adminViewMode = true; // true = admin mode, false = student mode
let allCatalogItems = [];
let isEditingItem = false;

async function checkAdminRole() {
  try {
    const token = await getToken();
    const decoded = await verifyToken(token);
    const roles = decoded['https://mo-classroom.us/roles'] || [];
    return roles.includes('admin');
  } catch {
    return false;
  }
}

async function verifyToken(token) {
  // decode JWT payload
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const payload = JSON.parse(atob(parts[1]));
  return payload;
}

function initAdminUI() {
  const adminPanel = document.getElementById('admin-panel');
  const adminToggleBtn = document.getElementById('admin-toggle-btn');
  const storeContent = document.querySelector('.store-content');
  
  if (!adminPanel || !adminToggleBtn) return;
  
  // check URL parameter before rendering admin view
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  adminViewMode = viewParam !== 'student';
  
  adminToggleBtn.style.display = 'flex';
  
  const toggleText = document.getElementById('admin-toggle-text');
  if (adminViewMode) {
    adminPanel.style.display = 'block';
    storeContent.style.display = 'none';
    if (toggleText) toggleText.textContent = 'Switch to Student View';
  } else {
    adminPanel.style.display = 'none';
    storeContent.style.display = '';
    if (toggleText) toggleText.textContent = 'Switch to Admin View';
  }
  
  adminToggleBtn.addEventListener('click', () => {
    adminViewMode = !adminViewMode;
    const toggleText = document.getElementById('admin-toggle-text');
    
    // update URL parameter
    const url = new URL(window.location);
    if (adminViewMode) {
      url.searchParams.delete('view');
      adminPanel.style.display = 'block';
      storeContent.style.display = 'none';
      toggleText.textContent = 'Switch to Student View';
    } else {
      url.searchParams.set('view', 'student');
      adminPanel.style.display = 'none';
      storeContent.style.display = '';
      toggleText.textContent = 'Switch to Admin View';
    }
    window.history.replaceState({}, '', url);
  });
  
  const form = document.getElementById('catalog-item-form');
  form?.addEventListener('submit', handleCatalogSubmit);
  
  document.getElementById('cancel-item-btn')?.addEventListener('click', resetCatalogForm);
  
  // Restore last-open admin tab from sessionStorage (index of details)
  const adminDetails = Array.from(document.querySelectorAll('.admin-collapsible'));
  const lastOpen = sessionStorage.getItem('mobank_admin_last_tab');
  if (lastOpen !== null) {
    const idx = parseInt(lastOpen, 10);
    adminDetails.forEach((d, i) => {
      try { d.open = i === idx; } catch (e) {}
    });
  }

  loadAdminCatalog();
  loadPendingOrders();
  
  wireAdminEvents();
  wireAdminCollapsiblePersistence();
}

// Persist which admin collapsible is open
function wireAdminCollapsiblePersistence() {
  const adminDetails = Array.from(document.querySelectorAll('.admin-collapsible'));
  adminDetails.forEach((d, i) => {
    d.addEventListener('toggle', () => {
      if (d.open) {
        sessionStorage.setItem('mobank_admin_last_tab', String(i));
      } else {
        // if it's closed, ensure at least one remains open; prefer first
        const anyOpen = adminDetails.some(ad => ad.open);
        if (!anyOpen) {
          adminDetails[0].open = true;
          sessionStorage.setItem('mobank_admin_last_tab', '0');
        }
      }
    });
  });
}

function wireAdminEvents() {
  const catalogItems = document.getElementById('admin-catalog-items');
  catalogItems?.addEventListener('click', evt => {
    const button = evt.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const itemId = button.dataset.itemId;
    
    if (action === 'edit' && itemId) {
      editCatalogItem(itemId);
    } else if (action === 'delete' && itemId) {
      deleteCatalogItem(itemId);
    }
  });
  
  const ordersList = document.getElementById('pending-orders-list');
  ordersList?.addEventListener('click', evt => {
    const button = evt.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const orderId = button.dataset.orderId;
    const userId = button.dataset.userId;
    
    if (action === 'fulfill' && orderId && userId) {
      showConfirmModal(
        'Mark Order as Fulfilled',
        'Are you sure you want to mark this order as fulfilled?',
        () => fulfillOrderClick(orderId, userId),
        'Mark as Fulfilled',
        'primary'
      );
    } else if (action === 'decline' && orderId && userId) {
      showDeclineModal(orderId, userId);
    }
  });
}

async function loadAdminCatalog() {
  const cached = CACHE.read(STORE_ADMIN_CATALOG_CACHE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    allCatalogItems = cached;
    renderAdminCatalog();
    return;
  }
  
  try {
    const token = await getToken();
    const res = await fetch('/api/getCatalogAdmin', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
    const data = await res.json();
    
    // return ALL items regardless of period
    allCatalogItems = data.items || [];
    CACHE.write(STORE_ADMIN_CATALOG_CACHE_KEY, allCatalogItems, STORE_CACHE_MAX_AGE);
    renderAdminCatalog();
  } catch (error) {
    showToast('Error', 'Failed to load admin catalog', 'danger');
  }
}

function renderAdminCatalog() {
  const container = document.getElementById('admin-catalog-items');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!allCatalogItems.length) {
    container.innerHTML = '<p class="empty-message">No catalog items yet. Create one below.</p>';
    return;
  }
  
  allCatalogItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'admin-catalog-card';
    card.innerHTML = `
      <div class="admin-card-header">
        <h5>${item.name}</h5>
        <span class="status-badge ${item.enabled ? 'enabled' : 'disabled'}">${item.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <p class="admin-card-description">${item.description}</p>
      <div class="admin-card-meta">
        <span>${formatMoBucks(item.price, { absolute: true })}</span>
        <span>${item.stock === null ? 'Unlimited' : `${item.stock} in stock`}</span>
      </div>
      <div class="admin-card-periods">
        ${item.validPeriods && item.validPeriods.length > 0 
          ? `Periods: ${item.validPeriods.map(p => periodNames[p] || `Period ${p}`).join(', ')}`
          : 'All periods'}
      </div>
      <div class="admin-card-actions">
        <button class="secondary-button" data-action="edit" data-item-id="${item.id}">Edit</button>
        <button class="danger-button" data-action="delete" data-item-id="${item.id}">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function handleCatalogSubmit(evt) {
  evt.preventDefault();
  
  const itemId = document.getElementById('item-id').value;
  const name = document.getElementById('item-name').value.trim();
  const description = document.getElementById('item-description').value.trim();
  const price = parseInt(document.getElementById('item-price').value, 10);
  const stockInput = document.getElementById('item-stock').value;
  const stock = stockInput === '' ? null : parseInt(stockInput, 10);
  const maxPerUserInput = document.getElementById('item-max-per-user').value;
  const maxPerUser = maxPerUserInput === '' ? null : parseInt(maxPerUserInput, 10);
  const enabled = document.getElementById('item-enabled').checked;
  
  const periodCheckboxes = document.querySelectorAll('input[name="valid-period"]:checked');
  const validPeriods = Array.from(periodCheckboxes).map(cb => parseInt(cb.value, 10));
  
  const payload = {
    name,
    description,
    price,
    stock,
    maxPerUser,
    enabled,
    validPeriods
  };
  
  const saveBtn = document.getElementById('save-item-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    const token = await getToken();
    const method = itemId ? 'PUT' : 'POST';
    if (itemId) payload.id = itemId;
    
    const res = await fetch('/api/manageCatalogItem', {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed: ${res.status}`);
    }
    
    showToast('Success', itemId ? 'Item updated successfully' : 'Item created successfully', 'success');
    isEditingItem = false;
    resetCatalogForm();
    
    // invalidate caches
    CACHE.remove(STORE_CACHE_KEY);
    CACHE.remove(STORE_ADMIN_CATALOG_CACHE_KEY);
    
    await loadAdminCatalog();
    
    try {
      const catalogPayload = await loadCatalog({ forceRefresh: true });
      state.catalog = catalogPayload.items || [];
      buildCatalogIndex(state.catalog);
      applyFilters();
    } catch {}
    
  } catch (error) {
    console.error('handleCatalogSubmit error:', error);
    showToast('Error', error.message || 'Failed to save item', 'danger');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = itemId ? 'Update Item' : 'Create Item';
  }
}

function resetCatalogForm() {
  const wasEditing = isEditingItem;
  const form = document.getElementById('catalog-item-form');
  form?.reset();
  document.getElementById('item-id').value = '';
  document.getElementById('save-item-btn').textContent = 'Create Item';
  document.getElementById('cancel-item-btn').textContent = 'Cancel';
  
  const formTitle = document.getElementById('form-section-title');
  if (formTitle) formTitle.textContent = 'Add New Item';
  
  isEditingItem = false;
  if (wasEditing) {
    showToast('Editing canceled', 'Ready to create a new item');
  }
}

function editCatalogItem(itemId) {
  const item = allCatalogItems.find(i => i.id === itemId);
  if (!item) return;
  
  isEditingItem = true;
  
  document.getElementById('item-id').value = item.id;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-description').value = item.description;
  document.getElementById('item-price').value = item.price;
  document.getElementById('item-stock').value = item.stock === null ? '' : item.stock;
  document.getElementById('item-max-per-user').value = item.maxPerUser === null ? '' : item.maxPerUser;
  document.getElementById('item-enabled').checked = item.enabled !== false;
  
  // uncheck all period checkboxes
  document.querySelectorAll('input[name="valid-period"]').forEach(cb => cb.checked = false);
  
  if (item.validPeriods && item.validPeriods.length > 0) {
    item.validPeriods.forEach(period => {
      const checkbox = document.querySelector(`input[name="valid-period"][value="${period}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
  
  document.getElementById('save-item-btn').textContent = 'Update Item';
  document.getElementById('cancel-item-btn').textContent = 'Stop Editing';
  
  const formTitle = document.getElementById('form-section-title');
  if (formTitle) formTitle.textContent = `Edit: ${item.name}`;
  
  const formDetails = document.querySelector('.admin-collapsible:nth-of-type(2)');
  if (formDetails && !formDetails.open) {
    formDetails.open = true;
  }
  
  document.getElementById('catalog-item-form')?.scrollIntoView({ behavior: 'smooth' });
};

function deleteCatalogItem(itemId) {
  showConfirmModal(
    'Delete Item',
    'Are you sure you want to delete this item? This cannot be undone.',
    async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/manageCatalogItem', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ id: itemId })
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed: ${res.status}`);
        }

        showToast('Success', 'Item deleted', 'success');

        // invalidate caches
        CACHE.remove(STORE_CACHE_KEY);
        CACHE.remove(STORE_ADMIN_CATALOG_CACHE_KEY);

        await loadAdminCatalog();

        try {
          const catalogPayload = await loadCatalog({ forceRefresh: true });
          state.catalog = catalogPayload.items || [];
          buildCatalogIndex(state.catalog);
          applyFilters();
        } catch {}

      } catch (error) {
        console.error('deleteCatalogItem error:', error);
        showToast('Error', error.message || 'Failed to delete item', 'danger');
      }
    },
    'Delete Item',
    'danger'
  );
}

async function loadPendingOrders() {
  const cached = CACHE.read(STORE_ORDERS_CACHE_KEY);
  if (cached && Array.isArray(cached)) {
    const pendingOrders = cached.filter(o => o.status === 'pending');
    renderPendingOrders(pendingOrders);
    return;
  }
  
  try {
    const token = await getToken();
    
    // fetch all pending orders
    const res = await fetch('/api/getOrdersAdmin', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error(`Failed to load orders: ${res.status}`);
    const data = await res.json();
    
    // cache all pending orders
    CACHE.write(STORE_ORDERS_CACHE_KEY, data.orders || [], STORE_CACHE_MAX_AGE);
    
    const pendingOrders = (data.orders || []).filter(o => o.status === 'pending');
    renderPendingOrders(pendingOrders);
  } catch (error) {
    console.error('loadPendingOrders error:', error);
  }
}

function renderPendingOrders(orders) {
  const container = document.getElementById('pending-orders-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!orders.length) {
    container.innerHTML = '<p class="empty-message">No pending orders</p>';
    return;
  }
  
  orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'pending-order-card';
    const date = new Date(order.createdAt).toLocaleString();
    const itemsList = order.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
    
    const customerInfo = order.userName ? `${order.userName}${order.userPeriod ? ` · ${periodNames[order.userPeriod] || `Period ${order.userPeriod}`}` : ''}` : 'Unknown User';
    
    card.innerHTML = `
      <div class="order-header">
        <span class="order-id">Order #${order.id.slice(-8)}</span>
        <span class="order-date">${date}</span>
      </div>
      <div class="order-customer">Customer: ${customerInfo}</div>
      <div class="order-items">${itemsList}</div>
      <div class="order-footer">
        <span class="order-total">Total: ${formatMoBucks(order.total, { absolute: true })}</span>
        <div class="order-actions">
          <button class="danger-button" data-action="decline" data-order-id="${order.id}" data-user-id="${order.userId}">Decline & refund</button>
          <button class="primary-button" data-action="fulfill" data-order-id="${order.id}" data-user-id="${order.userId}">Mark as fulfilled</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function fulfillOrderClick(orderId, userId) {
  try {
    const token = await getToken();
    const res = await fetch('/api/fulfillOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ orderId, userId })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed: ${res.status}`);
    }
    
    showToast('Success', 'Order fulfilled', 'success');
    
    CACHE.remove(STORE_ORDERS_CACHE_KEY);
    await loadPendingOrders();
    
  } catch (error) {
    console.error('fulfillOrderClick error:', error);
    showToast('Error', error.message || 'Failed to fulfill order', 'danger');
  }
}

async function declineOrderClick(orderId, userId, reason) {
  try {
    const token = await getToken();
    const res = await fetch('/api/declineOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ orderId, userId, reason })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed: ${res.status}`);
    }
    
    showToast('Success', 'Order declined and refunded', 'success');
    
    CACHE.remove(STORE_ORDERS_CACHE_KEY);
    await loadPendingOrders();
    
  } catch (error) {
    console.error('declineOrderClick error:', error);
    showToast('Error', error.message || 'Failed to decline order', 'danger');
  }
};

// initialization
document.addEventListener('DOMContentLoaded', async () => {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;

  try {
    state.user = await getUserProfile();
    state.balance = state.user?.currency_balance || 0;
    renderBalance();
    renderUserContext(state.user || {});
  } catch (err) {
    console.error('MoStore: Unable to load user profile', err);
    showToast('Error', 'Could not load your profile. Some data may be unavailable.', 'danger');
  }

  // isAdmin check
  isAdmin = await checkAdminRole();
  
  try {
    const catalogPayload = await loadCatalog();
    state.catalog = catalogPayload.items || [];
    buildCatalogIndex(state.catalog);
    state.filtered = [...state.catalog];
    applyFilters();
  } catch (err) {
    console.error('MoStore: Unable to load catalog', err);
    showToast('Error', 'Store catalog failed to load. Please retry shortly.', 'danger');
  }
  
  // Load user's orders
  try {
    await loadMyOrders();
  } catch (err) {
    console.error('MoStore: Unable to load orders', err);
  }
  
  if (isAdmin) {
    initAdminUI();
  }

  wireCatalogEvents();
  wireCartEvents();
  wireCatalogControls();
  wireCartActions();
});

async function loadMyOrders() {
  try {
    const token = await getToken();
    const res = await fetch('/api/getOrders', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to load orders: ${res.status}`);
    }
    
    const data = await res.json();
    renderMyOrders(data.orders || []);
  } catch (error) {
    console.error('loadMyOrders error:', error);
    const container = document.getElementById('my-orders-list');
    if (container) {
      container.innerHTML = '<p class=\"orders-empty\">Failed to load orders</p>';
    }
  }
}

function renderMyOrders(orders) {
  const container = document.getElementById('my-orders-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!orders.length) {
    container.innerHTML = '<p class=\"orders-empty\">No orders yet. Start shopping!</p>';
    return;
  }
  
  // Show most recent 10 orders
  const recentOrders = orders.slice(0, 10);
  
  recentOrders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    const date = new Date(order.createdAt).toLocaleDateString();
    
    // Show item names with quantities
    const itemsText = order.items.length === 1 
      ? `${order.items[0].name} (x${order.items[0].quantity})` 
      : order.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
    
    const statusClass = order.status === 'pending' ? 'pending' : 
                        order.status === 'fulfilled' ? 'fulfilled' : 'cancelled';
    const statusText = order.status === 'pending' ? 'Pending' : 
                       order.status === 'fulfilled' ? 'Fulfilled' : 'Declined';
    
    card.innerHTML = `
      <div class="order-card-header">
        <span class="order-card-id">#${order.id.slice(-8)}</span>
        <span class="order-card-status ${statusClass}">${statusText}</span>
      </div>
      <div class="order-card-items">${itemsText}</div>
      <div class="order-card-footer">
        <span class="order-card-total">${formatMoBucks(order.total, { absolute: true })}</span>
        <span class="order-card-date">${date}</span>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// it's over