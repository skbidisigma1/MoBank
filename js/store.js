'use strict';

const STORE_CACHE_KEY = '__mobank_store_catalog';
const STORE_CACHE_MAX_AGE = 10 * 60 * 1000;
const STORE_CART_MAX_ITEMS = 20;

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
  8: 'Symphonic Orchestra',
  10: 'Chamber Orchestra'
};

const DUMMY_CATALOG = {
  version: 'demo-2025-09-26',
  items: [
    {
      id: 'spotlight-solo',
      name: 'Spotlight Solo Feature',
      description: 'Claim the spotlight during our next concert run-through with a featured solo moment and personalized lighting.',
      price: 260,
      category: 'experience',
      stock: 3,
      tags: ['experience', 'limited'],
      popularity: 95,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
      maxPerUser: 1
    },
    {
      id: 'vip-row',
      name: 'VIP Audience Row',
      description: 'Reserve a front-row section for your family or friends at the next concert with customized signage.',
      price: 180,
      category: 'perks',
      stock: null,
      tags: ['perks', 'family'],
      popularity: 88,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      maxPerUser: 2
    },
    {
      id: 'custom-merch-pack',
      name: 'Custom Merch Pack',
      description: 'Bundle includes a limited hoodie, enamel pin, and holographic sticker sheet designed by our student art team.',
      price: 320,
      category: 'merch',
      stock: 12,
      tags: ['merch', 'apparel'],
      popularity: 73,
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
      maxPerUser: 1
    },
    {
      id: 'director-lunch',
      name: 'Director Lunch & Jam Session',
      description: 'Enjoy lunch with the directors, bring a friend, and jam through your favorite charts in an exclusive rehearsal studio.',
      price: 210,
      category: 'experience',
      stock: 5,
      tags: ['experience', 'premium'],
      popularity: 81,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
      maxPerUser: 1
    },
    {
      id: 'priority-practice-room',
      name: 'Priority Practice Room Access',
      description: 'Skip the sign-up sheet and reserve the practice suite during peak hours for an entire week.',
      price: 140,
      category: 'perks',
      stock: 8,
      tags: ['perks', 'practice'],
      popularity: 90,
      createdAt: Date.now() - 1000 * 60 * 60 * 12,
      maxPerUser: 2
    },
    {
      id: 'custom-ring-tone',
      name: 'Personalized Theme Music',
      description: 'Our student composer will produce a 20-second custom ringtone or theme inspired by your favorite genre.',
      price: 95,
      category: 'perks',
      stock: null,
      tags: ['perks', 'digital'],
      popularity: 64,
      createdAt: Date.now() - 1000 * 60 * 60 * 36,
      maxPerUser: 1
    },
    {
      id: 'concert-shoutout',
      name: 'Concert Shoutout & Dedication',
      description: 'Dedicate a concert piece to someone special with a shoutout in the program and on-stage mention.',
      price: 125,
      category: 'limited',
      stock: 6,
      tags: ['limited', 'experience'],
      popularity: 79,
      createdAt: Date.now() - 1000 * 60 * 60 * 72,
      maxPerUser: 1
    },
    {
      id: 'section-party',
      name: 'Section Party Kit',
      description: 'We supply snacks, decor, and a curated playlist for an after-rehearsal hangout with your entire section.',
      price: 285,
      category: 'experience',
      stock: 4,
      tags: ['experience', 'section'],
      popularity: 84,
      createdAt: Date.now() - 1000 * 60 * 60 * 48,
      maxPerUser: 1
    }
  ]
};

/* ---------- Auth & Data Helpers ---------- */
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
  if (!forceRefresh) {
    const cached = CACHE.read(STORE_CACHE_KEY);
    if (cached && cached.items && Array.isArray(cached.items)) {
      return cached;
    }
  }
  // Simulate fetch delay and return dummy payload
  await new Promise(resolve => setTimeout(resolve, 180));
  const payload = deepClone(DUMMY_CATALOG);
  CACHE.write(STORE_CACHE_KEY, payload, STORE_CACHE_MAX_AGE);
  return payload;
}

/* ---------- Rendering Helpers ---------- */
function renderBalance() {
  const balanceEl = selectors.balanceValue();
  if (!balanceEl) return;
  const balance = Number(state.balance || 0);
  const formatted = `${balance < 0 ? '-' : ''}$${Math.abs(balance).toLocaleString()}`;
  balanceEl.textContent = formatted;
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
    case 'popular':
      return arr.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    case 'new':
    default:
      return arr.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function renderCatalog() {
  const grid = selectors.catalogGrid();
  if (!grid) return;

  grid.innerHTML = '';

  if (!state.filtered.length) {
    grid.innerHTML = '<p class="catalog-no-results">No rewards match your search just yet. Try a different keyword or sorting option.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'catalog-card';
    card.dataset.itemId = item.id;

    const stockLabel = item.stock == null ? 'Unlimited' : `${item.stock} left`;
    const isSoldOut = item.stock === 0;

    card.innerHTML = `
      <h3 class="catalog-card__title">${item.name}</h3>
      <p class="catalog-card__description">${item.description}</p>
      <div class="catalog-card__meta">
        <span class="catalog-card__price">$${item.price.toLocaleString()}</span>
        <span class="catalog-card__stock ${isSoldOut ? 'sold-out' : ''}">${isSoldOut ? 'Sold Out' : stockLabel}</span>
      </div>
      <button class="primary-button" data-action="add-to-cart" ${isSoldOut ? 'disabled' : ''}>${isSoldOut ? 'Sold Out' : 'Add to cart'}</button>
    `;

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
  state.cart.forEach(({ item, quantity }) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <div>
        <p class="cart-item__name">${item.name}</p>
        <p class="cart-item__details">$${item.price.toLocaleString()} · ${quantity} ${quantity === 1 ? 'unit' : 'units'}</p>
      </div>
      <div class="cart-item__actions">
        <div class="cart-quantity" role="group" aria-label="Quantity controls">
          <button type="button" data-action="decrement" aria-label="Decrease quantity">−</button>
          <span>${quantity}</span>
          <button type="button" data-action="increment" aria-label="Increase quantity">+</button>
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

  subtotalEl.textContent = `$${subtotal.toLocaleString()}`;
  const remaining = (Number(state.balance) || 0) - subtotal;
  const formattedRemaining = `${remaining < 0 ? '-' : ''}$${Math.abs(remaining).toLocaleString()}`;
  remainingEl.textContent = formattedRemaining;
  remainingEl.style.color = remaining < 0 ? '#fca5a5' : '';

  checkoutBtn.disabled = !state.cart.size || remaining < 0;
}

function addToCart(itemId) {
  if (state.cart.size >= STORE_CART_MAX_ITEMS && !state.cart.has(itemId)) {
    showToast('Cart full', 'You can only keep 20 unique items in your cart at once.', 'warning');
    return;
  }

  const item = state.catalogIndex.get(itemId);
  if (!item) {
    showToast('Not available', 'This item is no longer available.', 'warning');
    return;
  }
  if (item.stock === 0) {
    showToast('Sold out', 'Sorry, this reward sold out. Check back later!', 'warning');
    return;
  }

  const current = state.cart.get(itemId) || { item, quantity: 0 };
  const nextQty = current.quantity + 1;
  if (item.stock != null && nextQty > item.stock) {
    showToast('Inventory limit', 'You cannot add more than the remaining stock.', 'danger');
    return;
  }
  if (item.maxPerUser != null && nextQty > item.maxPerUser) {
    showToast('Limit reached', 'This reward has a per-user limit.', 'danger');
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
    showToast('Inventory limit', 'No more stock available for this reward.', 'danger');
    return;
  }
  if (entry.item.maxPerUser != null && nextQty > entry.item.maxPerUser) {
    showToast('Limit reached', 'Per-user limit reached for this reward.', 'danger');
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
  const grid = selectors.catalogGrid();
  grid?.addEventListener('click', evt => {
    const action = evt.target.closest('[data-action]');
    if (!action) return;
    const card = evt.target.closest('.catalog-card');
    if (!card) return;
    const itemId = card.dataset.itemId;
    if (!itemId) return;

    if (action.dataset.action === 'add-to-cart') {
      addToCart(itemId);
    }
  });
}

function wireCartEvents() {
  const container = selectors.cartContainer();
  container?.addEventListener('click', evt => {
    const button = evt.target.closest('[data-action]');
    if (!button) return;
    const itemRow = evt.target.closest('.cart-item');
    if (!itemRow) return;
    const itemId = itemRow.dataset.itemId;
    if (!itemId) return;

    switch (button.dataset.action) {
      case 'remove':
        removeFromCart(itemId);
        break;
      case 'increment':
        updateCartQuantity(itemId, 1);
        break;
      case 'decrement':
        updateCartQuantity(itemId, -1);
        break;
      default:
        break;
    }
  });
}

function wireCatalogControls() {
  const sortSelect = selectors.sortSelect();
  if (sortSelect) {
    sortSelect.value = state.sortOption;
  }

  selectors.searchInput()?.addEventListener('input', evt => {
    state.searchTerm = evt.target.value;
    applyFilters();
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
    showToast('Checkout coming soon', 'Purchasing opens once the backend endpoints are live.', 'info');
  });
}

function renderUserContext(profile) {
  const balancePanel = document.getElementById('store-balance-panel');
  if (!balancePanel) return;
  const subtitle = balancePanel.querySelector('.balance-label');
  if (subtitle && profile.class_period != null) {
    const periodName = periodNames[profile.class_period] || `Period ${profile.class_period}`;
    subtitle.innerHTML = `Your MoBuck Balance · <span class="balance-period">${periodName}</span>`;
  }
}

/* ---------- Initialization ---------- */
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

  try {
    const catalogPayload = await loadCatalog();
    state.catalog = catalogPayload.items || [];
    buildCatalogIndex(state.catalog);
    applyFilters();
  } catch (err) {
    console.error('MoStore: Unable to load catalog', err);
    showToast('Error', 'Store catalog failed to load. Please retry shortly.', 'danger');
  }

  wireCatalogEvents();
  wireCartEvents();
  wireCatalogControls();
  wireCartActions();
});
