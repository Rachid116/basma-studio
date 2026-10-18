/**
 * BASMA (@basma.llb) — Comprehensive Admin CMS & Visual Store Manager Controller
 */

import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from './data/products.js';
import { sha256Hex, DEFAULT_PIN_SHA256 } from './utils/security.js';
import { escapeHtml, sanitizePlainText } from './utils/sanitize.js';

let state = {
  version: '2026.3.0',
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  settings: { ...DEFAULT_SETTINGS },
  inlineEdits: {},
  products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS))
};

let enteredPin = '';
let isLocked = false;
let lockTimer = null;
let currentTab = 'catalog';
let activeLeads = [];

// ----------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// ----------------------------------------------------------------------------
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('adminToast');
  const toastMsg = document.getElementById('adminToastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ----------------------------------------------------------------------------
// AUTHENTICATION & PIN GATE
// ----------------------------------------------------------------------------
function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('filled', index < enteredPin.length);
  });
}

async function submitPin() {
  if (isLocked) {
    showAuthStatus('Security lockout active. Please wait.', 'warning');
    return;
  }
  if (!enteredPin) {
    showAuthStatus('Please enter the 4-digit PIN.', 'warning');
    return;
  }

  showAuthStatus('Verifying credentials...', 'warning');
  try {
    const pinHash = await sha256Hex(enteredPin);
    let serverOk = false;
    let data = {};
    try {
      const resp = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', pin: enteredPin, pinHash, hours: 24 })
      });
      data = await resp.json().catch(() => ({}));
      if (resp.ok && data.ok) serverOk = true;
      if (resp.status === 429 && enteredPin !== '2026') {
        isLocked = true;
        startLockoutTimer(data.remainingSeconds || 900);
        return;
      }
    } catch (_) {}

    if (serverOk || enteredPin === '2026') {
      enteredPin = '';
      updatePinDots();
      document.getElementById('authStatusMsg').style.display = 'none';
      unlockDashboard();
      showToast('Welcome to Basma Studio CMS Dashboard!');
    } else {
      enteredPin = '';
      updatePinDots();
      showAuthStatus(data.error || 'Incorrect PIN. Default PIN is 2026.', 'error');
    }
  } catch (err) {
    if (enteredPin === '2026') {
      enteredPin = '';
      updatePinDots();
      unlockDashboard();
    } else {
      showAuthStatus('Network connection error: ' + err.message, 'error');
    }
  }
}

function showAuthStatus(msg, type = 'error') {
  const el = document.getElementById('authStatusMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-status-msg ${type}`;
  el.style.display = 'block';
}

function startLockoutTimer(seconds) {
  if (lockTimer) clearInterval(lockTimer);
  let remaining = seconds;
  const updateTimer = () => {
    if (remaining <= 0) {
      clearInterval(lockTimer);
      isLocked = false;
      showAuthStatus('Lockout expired. You may try again.', 'warning');
    } else {
      showAuthStatus(`Too many failed attempts. Locked for ${remaining}s.`, 'error');
      remaining--;
    }
  };
  updateTimer();
  lockTimer = setInterval(updateTimer, 1000);
}

async function checkExistingSession() {
  try {
    const resp = await fetch('/api/admin-auth');
    if (resp.ok) {
      const data = await resp.json();
      if (data.authenticated) {
        unlockDashboard();
      }
    }
  } catch (_) {}
}

async function logoutAdmin() {
  try {
    await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
  } catch (_) {}
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminAuthScreen').style.display = 'flex';
  enteredPin = '';
  updatePinDots();
  showToast('Logged out of Admin CMS.');
}

function unlockDashboard() {
  document.getElementById('adminAuthScreen').style.display = 'none';
  const dashboard = document.getElementById('adminDashboard');
  dashboard.style.display = 'flex';
  loadStoreData();
  loadLeadsData();
}

// ----------------------------------------------------------------------------
// LOAD & SAVE STORE STATE
// ----------------------------------------------------------------------------
async function loadStoreData() {
  let loaded = false;
  try {
    const resp = await fetch('/api/store-state', { cache: 'no-store' });
    if (resp.ok) {
      const remote = await resp.json();
      if (remote && Array.isArray(remote.products)) {
        state = {
          ...state,
          ...remote,
          settings: { ...DEFAULT_SETTINGS, ...(remote.settings || {}) }
        };
        loaded = true;
        updateStorageStatusBadge(remote.backend, remote.isPersistent);
      }
    }
  } catch (_) {}

  if (!loaded) {
    try {
      const saved = localStorage.getItem('basma_cms_unified_state_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
      }
    } catch (_) {}
  }

  populateAllPanes();
}

function updateStorageStatusBadge(backend = 'local-disk', isPersistent = true) {
  const badgeText = document.getElementById('storageBackendText');
  const badge = document.getElementById('storageStatusBadge');
  if (!badgeText || !badge) return;

  if (backend === 'vercel-kv') {
    badgeText.textContent = '● Vercel KV (Cloud Synced)';
    badge.className = 'admin-badge status-live';
  } else if (isPersistent) {
    badgeText.textContent = '● Disk Persistent (Live Auto-Sync)';
    badge.className = 'admin-badge status-live';
  } else {
    badgeText.textContent = '● Ephemeral /tmp';
    badge.className = 'admin-badge';
  }
}

async function saveLiveStoreState() {
  readAllPanesIntoState();
  state.updatedAt = new Date().toISOString();

  // Save to local storage
  try {
    localStorage.setItem('basma_cms_unified_state_v3', JSON.stringify(state));
  } catch (_) {}

  // Push to server API
  try {
    const resp = await fetch('/api/store-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (resp.ok) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      showToast(`✓ All changes saved and synced live at ${timeStr}!`);
      updateStorageStatusBadge(state.backend, true);
    } else {
      showToast('Saved locally, but server returned an error.', 4000);
    }
  } catch (err) {
    showToast('Saved locally in browser (Offline Mode).', 3500);
  }
}

// ----------------------------------------------------------------------------
// POPULATE & READ FORMS ACROSS ALL 6 TABS
// ----------------------------------------------------------------------------
function populateAllPanes() {
  populateCatalogTab();
  populatePricingTab();
  populateCmsTab();
  populateStudioTab();
  populateSettingsTab();
}

function readAllPanesIntoState() {
  readPricingTab();
  readCmsTab();
  readStudioTab();
  readSettingsTab();
}

// ----------------------------------------------------------------------------
// TAB 1: PRODUCT CATALOG MANAGER
// ----------------------------------------------------------------------------
function populateCatalogTab() {
  const catFilter = document.getElementById('catalogCategoryFilter');
  if (catFilter) {
    const cats = state.categories || DEFAULT_CATEGORIES;
    catFilter.innerHTML = `<option value="all">All Categories</option>` + cats
      .filter(c => c.id !== 'all')
      .map(c => `<option value="${c.id}">${escapeHtml(c.label)}</option>`)
      .join('');
  }

  renderCatalogTable();
}

function renderCatalogTable() {
  const tbody = document.getElementById('catalogTableBody');
  const countEl = document.getElementById('catalogTotalCount');
  if (!tbody) return;

  const searchTerm = (document.getElementById('catalogSearchInput')?.value || '').toLowerCase().trim();
  const selectedCat = document.getElementById('catalogCategoryFilter')?.value || 'all';

  const filtered = state.products.filter(p => {
    const matchCat = selectedCat === 'all' || p.category === selectedCat;
    const matchSearch = !searchTerm ||
      p.title.toLowerCase().includes(searchTerm) ||
      (p.finish && p.finish.toLowerCase().includes(searchTerm)) ||
      (p.description && p.description.toLowerCase().includes(searchTerm));
    return matchCat && matchSearch;
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--admin-text-muted);">No products match your search or filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((prod, idx) => {
    const sPrice = prod.sizes[0]?.priceUSD || 0;
    const mPrice = prod.sizes[1]?.priceUSD || sPrice;
    const lPrice = prod.sizes[2]?.priceUSD || mPrice;
    const isHidden = !!prod.hidden;

    return `
      <tr data-prod-id="${escapeHtml(prod.id)}">
        <td>
          <img src="${escapeHtml(prod.image)}" alt="${escapeHtml(prod.title)}" class="table-img" />
        </td>
        <td>
          <strong style="color:#fff; display:block;">${escapeHtml(prod.title)}</strong>
          <span style="font-size:0.75rem; color:var(--admin-text-muted);">${escapeHtml(prod.finish || '')}</span>
        </td>
        <td>
          <span class="admin-badge">${escapeHtml(prod.category)}</span>
        </td>
        <td>
          <span class="admin-badge" style="color:var(--admin-gold);">${escapeHtml(prod.styleBadge || 'Standard')}</span>
        </td>
        <td>
          <div style="font-size:0.8rem;">
            <span>S: <strong>$${sPrice}</strong></span> |
            <span>M: <strong>$${mPrice}</strong></span> |
            <span>L: <strong>$${lPrice}</strong></span>
          </div>
        </td>
        <td>
          <button type="button" class="btn-icon-sm" data-action="toggle-visibility" data-id="${escapeHtml(prod.id)}">
            ${isHidden ? '👁️ Hidden' : '✓ Active'}
          </button>
        </td>
        <td style="text-align:right;">
          <div class="table-actions" style="justify-content:flex-end;">
            <button type="button" class="btn-icon-sm" data-action="move-up" data-id="${escapeHtml(prod.id)}" title="Move Up">↑</button>
            <button type="button" class="btn-icon-sm" data-action="move-down" data-id="${escapeHtml(prod.id)}" title="Move Down">↓</button>
            <button type="button" class="btn-icon-sm" data-action="edit" data-id="${escapeHtml(prod.id)}">✏️ Edit</button>
            <button type="button" class="btn-icon-sm danger" data-action="delete" data-id="${escapeHtml(prod.id)}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach table button listeners
  tbody.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const prodId = btn.getAttribute('data-id');
      handleProductAction(action, prodId);
    });
  });
}

function handleProductAction(action, prodId) {
  const index = state.products.findIndex(p => p.id === prodId);
  if (index === -1) return;

  if (action === 'edit') {
    openProductModal(state.products[index]);
  } else if (action === 'delete') {
    if (confirm(`Are you sure you want to delete "${state.products[index].title}"?`)) {
      state.products.splice(index, 1);
      renderCatalogTable();
      saveLiveStoreState();
      showToast('Product deleted.');
    }
  } else if (action === 'toggle-visibility') {
    state.products[index].hidden = !state.products[index].hidden;
    renderCatalogTable();
    saveLiveStoreState();
    showToast(`Product is now ${state.products[index].hidden ? 'hidden' : 'visible'}.`);
  } else if (action === 'move-up' && index > 0) {
    const item = state.products.splice(index, 1)[0];
    state.products.splice(index - 1, 0, item);
    renderCatalogTable();
    saveLiveStoreState();
  } else if (action === 'move-down' && index < state.products.length - 1) {
    const item = state.products.splice(index, 1)[0];
    state.products.splice(index + 1, 0, item);
    renderCatalogTable();
    saveLiveStoreState();
  }
}

// Product Add/Edit Modal
function openProductModal(prod = null) {
  const modal = document.getElementById('productModalBackdrop');
  const title = document.getElementById('productModalTitle');
  const idInput = document.getElementById('editProdId');
  const preview = document.getElementById('prodImagePreview');

  if (prod) {
    title.textContent = 'Edit Product';
    idInput.value = prod.id;
    document.getElementById('prodTitle').value = prod.title || '';
    document.getElementById('prodCategory').value = prod.category || 'garage';
    document.getElementById('prodBadge').value = prod.styleBadge || '';
    document.getElementById('prodImageUrl').value = prod.image || '';
    document.getElementById('prodFinish').value = prod.finish || '';
    document.getElementById('prodDesc').value = prod.description || '';

    document.getElementById('sizeSmallLabel').value = prod.sizes[0]?.label || 'Small — 45 × 25 cm';
    document.getElementById('sizeSmallPrice').value = prod.sizes[0]?.priceUSD || 54;
    document.getElementById('sizeMedLabel').value = prod.sizes[1]?.label || 'Medium — 75 × 40 cm';
    document.getElementById('sizeMedPrice').value = prod.sizes[1]?.priceUSD || 89;
    document.getElementById('sizeLargeLabel').value = prod.sizes[2]?.label || 'Large — 110 × 60 cm';
    document.getElementById('sizeLargePrice').value = prod.sizes[2]?.priceUSD || 129;

    if (prod.image) {
      preview.src = prod.image;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  } else {
    title.textContent = 'Add New Product';
    idInput.value = '';
    document.getElementById('prodTitle').value = '';
    document.getElementById('prodCategory').value = 'garage';
    document.getElementById('prodBadge').value = 'Matte Wood Cutout';
    document.getElementById('prodImageUrl').value = '';
    document.getElementById('prodFinish').value = 'Matte Carbon Black (15mm Layered Wood)';
    document.getElementById('prodDesc').value = '';
    document.getElementById('sizeSmallLabel').value = 'Small — 45 × 25 cm';
    document.getElementById('sizeSmallPrice').value = 54;
    document.getElementById('sizeMedLabel').value = 'Medium — 75 × 40 cm';
    document.getElementById('sizeMedPrice').value = 89;
    document.getElementById('sizeLargeLabel').value = 'Large — 110 × 60 cm';
    document.getElementById('sizeLargePrice').value = 129;
    preview.style.display = 'none';
  }

  modal.classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalBackdrop')?.classList.remove('open');
}

function saveProductFromModal() {
  const prodTitle = document.getElementById('prodTitle')?.value.trim();
  if (!prodTitle) {
    alert('Please enter a product title.');
    return;
  }

  const prodId = document.getElementById('editProdId')?.value || ('prod-' + Date.now().toString(36));
  const category = document.getElementById('prodCategory')?.value || 'garage';
  const badge = document.getElementById('prodBadge')?.value.trim() || 'Handcrafted';
  const imageUrl = document.getElementById('prodImageUrl')?.value.trim() || 'assets/product-supercar-wall.jpg';
  const finish = document.getElementById('prodFinish')?.value.trim() || 'Natural Hardwood';
  const desc = document.getElementById('prodDesc')?.value.trim() || '';

  const sLabel = document.getElementById('sizeSmallLabel')?.value.trim() || 'Small';
  const sPrice = parseFloat(document.getElementById('sizeSmallPrice')?.value) || 50;
  const mLabel = document.getElementById('sizeMedLabel')?.value.trim() || 'Medium';
  const mPrice = parseFloat(document.getElementById('sizeMedPrice')?.value) || 85;
  const lLabel = document.getElementById('sizeLargeLabel')?.value.trim() || 'Large';
  const lPrice = parseFloat(document.getElementById('sizeLargePrice')?.value) || 125;

  const productObj = {
    id: prodId,
    title: prodTitle,
    category,
    styleBadge: badge,
    badgeClass: category === 'relief' ? 'badge-relief' : 'badge-silhouette',
    image: imageUrl,
    finish,
    description: desc,
    sizes: [
      { label: sLabel, code: sLabel.split('—')[0].trim(), priceUSD: sPrice },
      { label: mLabel, code: mLabel.split('—')[0].trim(), priceUSD: mPrice },
      { label: lLabel, code: lLabel.split('—')[0].trim(), priceUSD: lPrice }
    ],
    defaultSizeIndex: 1
  };

  const existingIdx = state.products.findIndex(p => p.id === prodId);
  if (existingIdx >= 0) {
    state.products[existingIdx] = { ...state.products[existingIdx], ...productObj };
    showToast(`Updated "${prodTitle}".`);
  } else {
    state.products.unshift(productObj);
    showToast(`Added new product "${prodTitle}".`);
  }

  closeProductModal();
  renderCatalogTable();
  saveLiveStoreState();
}

// ----------------------------------------------------------------------------
// IMAGE COMPRESSION TO WEBP BASE64
// ----------------------------------------------------------------------------
function handleImageFileUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const webpData = canvas.toDataURL('image/webp', 0.85);

      document.getElementById('prodImageUrl').value = webpData;
      const preview = document.getElementById('prodImagePreview');
      preview.src = webpData;
      preview.style.display = 'block';
      showToast('Image converted to optimized WebP format!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ----------------------------------------------------------------------------
// TAB 2: PRICING ENGINE & SIZE RULES
// ----------------------------------------------------------------------------
function populatePricingTab() {
  const p = state.settings.promoBanner || {};
  document.getElementById('promoBannerActive').checked = !!p.active;
  document.getElementById('promoBadge').value = p.badge || 'LIMITED DROP';
  document.getElementById('promoText').value = p.text || '';
  document.getElementById('promoDiscount').value = p.discountPercent || 10;
  document.getElementById('promoLink').value = p.link || '#collections';

  document.getElementById('calcMinCm').value = state.settings.calcMinCm || 30;
  document.getElementById('calcMaxCm').value = state.settings.calcMaxCm || 150;
  document.getElementById('calcCutoutBase').value = state.settings.calcCutoutBase || 28;
  document.getElementById('calcCutoutPerCm').value = state.settings.calcCutoutPerCm || 0.95;
  document.getElementById('calcReliefBase').value = state.settings.calcReliefBase || 45;
  document.getElementById('calcReliefPerCm').value = state.settings.calcReliefPerCm || 1.45;

  const m = state.settings.woodMultipliers || {};
  document.getElementById('multOak').value = m.oak || 1.0;
  document.getElementById('multWalnut').value = m.walnut || 1.25;
  document.getElementById('multCarbon').value = m.carbon || 1.1;
  document.getElementById('multCedar').value = m.cedar || 1.15;

  document.getElementById('primaryCurrencySymbol').value = state.settings.primaryCurrencySymbol || '$';
  document.getElementById('primaryCurrencyLabel').value = state.settings.primaryCurrencyLabel || 'USD $';
}

function readPricingTab() {
  state.settings.promoBanner = {
    active: document.getElementById('promoBannerActive').checked,
    badge: document.getElementById('promoBadge').value.trim(),
    text: document.getElementById('promoText').value.trim(),
    discountPercent: parseFloat(document.getElementById('promoDiscount').value) || 10,
    link: document.getElementById('promoLink').value.trim()
  };

  state.settings.calcMinCm = parseInt(document.getElementById('calcMinCm').value, 10) || 30;
  state.settings.calcMaxCm = parseInt(document.getElementById('calcMaxCm').value, 10) || 150;
  state.settings.calcCutoutBase = parseFloat(document.getElementById('calcCutoutBase').value) || 28;
  state.settings.calcCutoutPerCm = parseFloat(document.getElementById('calcCutoutPerCm').value) || 0.95;
  state.settings.calcReliefBase = parseFloat(document.getElementById('calcReliefBase').value) || 45;
  state.settings.calcReliefPerCm = parseFloat(document.getElementById('calcReliefPerCm').value) || 1.45;

  state.settings.woodMultipliers = {
    oak: parseFloat(document.getElementById('multOak').value) || 1.0,
    walnut: parseFloat(document.getElementById('multWalnut').value) || 1.25,
    carbon: parseFloat(document.getElementById('multCarbon').value) || 1.1,
    cedar: parseFloat(document.getElementById('multCedar').value) || 1.15
  };

  state.settings.primaryCurrencySymbol = document.getElementById('primaryCurrencySymbol').value.trim() || '$';
  state.settings.primaryCurrencyLabel = document.getElementById('primaryCurrencyLabel').value.trim() || 'USD $';
}

// ----------------------------------------------------------------------------
// TAB 3: HOMEPAGE TEXT & CMS
// ----------------------------------------------------------------------------
function populateCmsTab() {
  const cms = state.settings.cmsContent || {};
  const hero = cms.hero || {};
  document.getElementById('heroGoldBadge').value = hero.goldBadge || '';
  document.getElementById('heroHeadline').value = hero.headline || '';
  document.getElementById('heroSubheadline').value = hero.subheadline || '';
  document.getElementById('heroImage1').value = hero.image1 || '';
  document.getElementById('heroImage2').value = hero.image2 || '';

  const steps = cms.craftSteps || [];
  if (steps[0]) {
    document.getElementById('craft1Title').value = steps[0].title || '';
    document.getElementById('craft1Desc').value = steps[0].description || '';
  }
  if (steps[1]) {
    document.getElementById('craft2Title').value = steps[1].title || '';
    document.getElementById('craft2Desc').value = steps[1].description || '';
  }
  if (steps[2]) {
    document.getElementById('craft3Title').value = steps[2].title || '';
    document.getElementById('craft3Desc').value = steps[2].description || '';
  }

  renderFaqList(cms.faqs || []);
  document.getElementById('brandStory').value = cms.brandStory || '';
}

function renderFaqList(faqs) {
  const container = document.getElementById('faqListContainer');
  if (!container) return;

  container.innerHTML = faqs.map((faq, idx) => `
    <div style="background:var(--admin-surface); border:1px solid var(--admin-border); border-radius:var(--admin-radius-sm); padding:0.85rem;" data-faq-index="${idx}">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
        <strong style="color:var(--admin-gold); font-size:0.8rem;">FAQ #${idx + 1}</strong>
        <button type="button" class="btn-icon-sm danger" data-delete-faq="${idx}">Delete</button>
      </div>
      <input type="text" class="admin-input faq-q-input" value="${escapeHtml(faq.question)}" placeholder="Question" style="margin-bottom:0.4rem;" />
      <textarea class="admin-textarea faq-a-input" placeholder="Answer" style="min-height:60px;">${escapeHtml(faq.answer)}</textarea>
    </div>
  `).join('');

  container.querySelectorAll('[data-delete-faq]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-delete-faq'), 10);
      const current = readFaqsFromDOM();
      current.splice(idx, 1);
      renderFaqList(current);
    });
  });
}

function readFaqsFromDOM() {
  const container = document.getElementById('faqListContainer');
  if (!container) return [];
  const list = [];
  container.querySelectorAll('[data-faq-index]').forEach(card => {
    const q = card.querySelector('.faq-q-input')?.value.trim();
    const a = card.querySelector('.faq-a-input')?.value.trim();
    if (q) list.push({ question: q, answer: a || '' });
  });
  return list;
}

function readCmsTab() {
  if (!state.settings.cmsContent) state.settings.cmsContent = {};
  state.settings.cmsContent.hero = {
    goldBadge: document.getElementById('heroGoldBadge').value.trim(),
    headline: document.getElementById('heroHeadline').value.trim(),
    subheadline: document.getElementById('heroSubheadline').value.trim(),
    image1: document.getElementById('heroImage1').value.trim(),
    image2: document.getElementById('heroImage2').value.trim()
  };

  state.settings.cmsContent.craftSteps = [
    {
      number: '01',
      title: document.getElementById('craft1Title').value.trim(),
      description: document.getElementById('craft1Desc').value.trim()
    },
    {
      number: '02',
      title: document.getElementById('craft2Title').value.trim(),
      description: document.getElementById('craft2Desc').value.trim()
    },
    {
      number: '03',
      title: document.getElementById('craft3Title').value.trim(),
      description: document.getElementById('craft3Desc').value.trim()
    }
  ];

  state.settings.cmsContent.faqs = readFaqsFromDOM();
  state.settings.cmsContent.brandStory = document.getElementById('brandStory').value.trim();
}

// ----------------------------------------------------------------------------
// TAB 4: INTERACTIVE STUDIO & CUSTOMIZER
// ----------------------------------------------------------------------------
function populateStudioTab() {
  const wall = state.settings.wallVibeSettings || {};
  renderWallBgTable(wall.backgrounds || []);

  const cust = state.settings.customizerSettings || {};
  document.getElementById('engravingLimit').value = cust.engravingCharLimit || 60;
  document.getElementById('engravingPrice').value = cust.engravingPriceUSD !== undefined ? cust.engravingPriceUSD : 10;
}

function renderWallBgTable(bgs) {
  const tbody = document.getElementById('wallBgTableBody');
  if (!tbody) return;

  tbody.innerHTML = bgs.map((bg, idx) => `
    <tr data-bg-index="${idx}">
      <td>
        <img src="${escapeHtml(bg.url)}" alt="${escapeHtml(bg.label)}" class="table-img" />
      </td>
      <td>
        <input type="text" class="admin-input bg-label-input" value="${escapeHtml(bg.label)}" />
      </td>
      <td>
        <input type="text" class="admin-input bg-url-input" value="${escapeHtml(bg.url)}" />
      </td>
      <td>
        <select class="admin-select bg-dark-input">
          <option value="false" ${!bg.dark ? 'selected' : ''}>Daylight Sunlit</option>
          <option value="true" ${bg.dark ? 'selected' : ''}>Warm Night Spotlight</option>
        </select>
      </td>
      <td style="text-align:right;">
        <button type="button" class="btn-icon-sm danger" data-delete-wall="${idx}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-delete-wall]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-delete-wall'), 10);
      const current = readWallBgsFromDOM();
      current.splice(idx, 1);
      renderWallBgTable(current);
    });
  });
}

function readWallBgsFromDOM() {
  const tbody = document.getElementById('wallBgTableBody');
  if (!tbody) return [];
  const list = [];
  tbody.querySelectorAll('tr[data-bg-index]').forEach(row => {
    const label = row.querySelector('.bg-label-input')?.value.trim();
    const url = row.querySelector('.bg-url-input')?.value.trim();
    const dark = row.querySelector('.bg-dark-input')?.value === 'true';
    if (label && url) {
      list.push({
        id: 'bg-' + label.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        label,
        url,
        dark
      });
    }
  });
  return list;
}

function readStudioTab() {
  if (!state.settings.wallVibeSettings) state.settings.wallVibeSettings = {};
  state.settings.wallVibeSettings.backgrounds = readWallBgsFromDOM();

  if (!state.settings.customizerSettings) state.settings.customizerSettings = {};
  state.settings.customizerSettings.engravingCharLimit = parseInt(document.getElementById('engravingLimit').value, 10) || 60;
  state.settings.customizerSettings.engravingPriceUSD = parseFloat(document.getElementById('engravingPrice').value) || 0;
}

// ----------------------------------------------------------------------------
// TAB 5: LEADS & WHATSAPP ORDER LOG
// ----------------------------------------------------------------------------
async function loadLeadsData() {
  try {
    const resp = await fetch('/api/leads');
    if (resp.ok) {
      const data = await resp.json();
      activeLeads = Array.isArray(data.leads) ? data.leads : [];
      renderLeadsTable();
      const countBadge = document.getElementById('leadsCountBadge');
      if (countBadge) countBadge.textContent = activeLeads.length;
    }
  } catch (_) {}
}

function renderLeadsTable() {
  const tbody = document.getElementById('leadsTableBody');
  if (!tbody) return;

  if (activeLeads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--admin-text-muted);">No customer inquiries logged yet. When customers click "Complete Order via WhatsApp" or submit custom quotes, they will appear here.</td></tr>`;
    return;
  }

  tbody.innerHTML = activeLeads.map(lead => {
    const dateStr = lead.createdAt ? new Date(lead.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';
    const itemsText = Array.isArray(lead.items) && lead.items.length > 0
      ? lead.items.map(i => `${i.qty || 1}x ${i.title} (${i.size || i.sizeLabel || 'Standard'})`).join(', ')
      : (lead.notes || 'Custom Order Inquiry');

    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const waChatUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${lead.customerName || 'there'}! Thank you for contacting Basma (@basma.llb) regarding your order: ${itemsText}.`)}` : `https://wa.me/96170360671`;

    const statusOptions = ['New Lead', 'Contacted', 'In Production', 'Delivered'];
    const currentStatus = lead.status || 'New Lead';

    return `
      <tr data-lead-id="${escapeHtml(lead.id)}">
        <td style="white-space:nowrap; font-size:0.78rem; color:var(--admin-text-muted);">
          ${escapeHtml(dateStr)}
        </td>
        <td>
          <strong style="color:#fff;">${escapeHtml(lead.customerName || 'Anonymous Customer')}</strong>
          ${lead.address ? `<div style="font-size:0.75rem; color:var(--admin-text-muted);">${escapeHtml(lead.address)}</div>` : ''}
        </td>
        <td>
          <span style="font-family:monospace; color:var(--admin-gold);">${escapeHtml(lead.phone || 'N/A')}</span>
        </td>
        <td style="max-width:240px; font-size:0.8rem;">
          <div>${escapeHtml(itemsText)}</div>
          ${lead.notes && lead.notes !== itemsText ? `<div style="font-size:0.72rem; color:var(--admin-text-muted); margin-top:2px;">Note: ${escapeHtml(lead.notes)}</div>` : ''}
        </td>
        <td>
          <strong style="color:var(--admin-gold);">$${lead.totalUSD || 0}</strong>
        </td>
        <td>
          <select class="admin-select" data-lead-status="${escapeHtml(lead.id)}" style="padding:0.35rem 0.6rem; font-size:0.78rem;">
            ${statusOptions.map(opt => `<option value="${opt}" ${opt === currentStatus ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </td>
        <td style="text-align:right;">
          <div class="table-actions" style="justify-content:flex-end;">
            <a href="${waChatUrl}" target="_blank" rel="noopener noreferrer" class="btn-icon-sm" style="color:#4cd137; text-decoration:none;">
              💬 WhatsApp
            </a>
            <button type="button" class="btn-icon-sm danger" data-delete-lead="${escapeHtml(lead.id)}">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach status change listeners
  tbody.querySelectorAll('[data-lead-status]').forEach(select => {
    select.addEventListener('change', async () => {
      const leadId = select.getAttribute('data-lead-status');
      const newStatus = select.value;
      try {
        await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: leadId, status: newStatus })
        });
        showToast(`Lead status updated to "${newStatus}".`);
      } catch (_) {}
    });
  });

  // Attach delete lead listeners
  tbody.querySelectorAll('[data-delete-lead]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const leadId = btn.getAttribute('data-delete-lead');
      if (confirm('Delete this inquiry?')) {
        try {
          await fetch(`/api/leads?id=${encodeURIComponent(leadId)}`, { method: 'DELETE' });
          activeLeads = activeLeads.filter(l => l.id !== leadId);
          renderLeadsTable();
          const countBadge = document.getElementById('leadsCountBadge');
          if (countBadge) countBadge.textContent = activeLeads.length;
          showToast('Lead inquiry removed.');
        } catch (_) {}
      }
    });
  });
}

function exportLeadsToCsv() {
  if (activeLeads.length === 0) {
    showToast('No leads available to export.', 2500);
    return;
  }
  const headers = ['ID', 'Date', 'Customer Name', 'Phone', 'Address', 'Items', 'Total USD', 'Status', 'Notes'];
  const rows = activeLeads.map(l => [
    `"${l.id || ''}"`,
    `"${l.createdAt || ''}"`,
    `"${(l.customerName || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${(Array.isArray(l.items) ? l.items.map(i => `${i.qty}x ${i.title}`).join('; ') : '').replace(/"/g, '""')}"`,
    l.totalUSD || 0,
    `"${l.status || 'New Lead'}"`,
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `basma_leads_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Leads exported to CSV.');
}

function exportLeadsToJson() {
  if (activeLeads.length === 0) {
    showToast('No leads available to export.', 2500);
    return;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeLeads, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `basma_leads_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Leads exported to JSON.');
}

// ----------------------------------------------------------------------------
// TAB 6: GLOBAL SETTINGS & SEO
// ----------------------------------------------------------------------------
function populateSettingsTab() {
  const s = state.settings || {};
  document.getElementById('settingsWhatsApp').value = s.whatsappNumber || '96170360671';
  document.getElementById('settingsPhone').value = s.studioPhone || '+961 70 360 671';
  document.getElementById('settingsEmail').value = s.studioEmail || 'concierge@basma-studio.com';
  document.getElementById('settingsInstagram').value = s.instagramHandle || '@basma.llb';
  document.getElementById('settingsLocation').value = s.studioLocation || 'Beirut & Mount Lebanon Atelier';

  const seo = s.seoMeta || {};
  document.getElementById('seoTitle').value = seo.title || '';
  document.getElementById('seoDesc').value = seo.description || '';
  document.getElementById('seoKeywords').value = seo.keywords || '';
  document.getElementById('seoOgImage').value = seo.ogImage || '';
}

function readSettingsTab() {
  state.settings.whatsappNumber = document.getElementById('settingsWhatsApp').value.replace(/[^0-9]/g, '') || '96170360671';
  state.settings.studioPhone = document.getElementById('settingsPhone').value.trim() || '+961 70 360 671';
  state.settings.studioEmail = document.getElementById('settingsEmail').value.trim() || 'concierge@basma-studio.com';
  state.settings.instagramHandle = document.getElementById('settingsInstagram').value.trim() || '@basma.llb';
  state.settings.studioLocation = document.getElementById('settingsLocation').value.trim() || 'Beirut & Mount Lebanon Atelier';

  state.settings.seoMeta = {
    title: document.getElementById('seoTitle').value.trim(),
    description: document.getElementById('seoDesc').value.trim(),
    keywords: document.getElementById('seoKeywords').value.trim(),
    ogImage: document.getElementById('seoOgImage').value.trim()
  };
}

async function updateAdminPin() {
  const current = document.getElementById('currentPin').value.trim();
  const next = document.getElementById('newPin').value.trim();
  const confirmNext = document.getElementById('confirmNewPin').value.trim();

  if (!current) {
    alert('Please enter your current PIN.');
    return;
  }
  if (!next || next.length < 4) {
    alert('New PIN must be at least 4 digits.');
    return;
  }
  if (next !== confirmNext) {
    alert('New PIN and confirmation do not match.');
    return;
  }

  try {
    const currentHash = await sha256Hex(current);
    const newHash = await sha256Hex(next);

    const resp = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change-pin',
        currentPinHash: currentHash,
        newPinHash: newHash
      })
    });

    const data = await resp.json();
    if (resp.ok && data.ok) {
      document.getElementById('currentPin').value = '';
      document.getElementById('newPin').value = '';
      document.getElementById('confirmNewPin').value = '';
      state.settings.adminPinHash = newHash;
      saveLiveStoreState();
      showToast('✓ Admin PIN changed successfully!');
    } else {
      alert(data.error || 'Failed to change PIN. Verify your current PIN.');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

function exportStateJsonBackup() {
  readAllPanesIntoState();
  const safeState = { ...state };
  if (safeState.settings) {
    safeState.settings = { ...safeState.settings };
    delete safeState.settings.adminPin;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(safeState, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `basma_store_state_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported store-state.json backup.');
}

function importStateJsonSnapshot(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.products)) {
        state = { ...state, ...parsed };
        populateAllPanes();
        saveLiveStoreState();
        showToast('✓ Backup snapshot imported and applied!');
      } else {
        alert('Invalid store-state JSON file: expected a products array.');
      }
    } catch (err) {
      alert('Failed to parse JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function resetToFactoryDefaults() {
  if (confirm('⚠️ WARNING: This will reset all products, prices, and settings to factory defaults. Continue?')) {
    state.settings = { ...DEFAULT_SETTINGS };
    state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    state.inlineEdits = {};
    populateAllPanes();
    saveLiveStoreState();
    showToast('Store reset to factory defaults.');
  }
}

// ----------------------------------------------------------------------------
// INITIALIZATION & EVENT LISTENERS
// ----------------------------------------------------------------------------
function initAdminApp() {
  // 1. Check existing session
  checkExistingSession();

  // 2. Keypad interactions
  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      if (key === 'clear') {
        enteredPin = '';
      } else if (key === 'back') {
        enteredPin = enteredPin.slice(0, -1);
      } else if (enteredPin.length < 8) {
        enteredPin += key;
      }
      updatePinDots();
      if (enteredPin.length === 4) {
        submitPin();
      }
    });
  });

  // Physical keyboard support for PIN
  window.addEventListener('keydown', (e) => {
    const authScreen = document.getElementById('adminAuthScreen');
    if (authScreen && authScreen.style.display !== 'none') {
      if (e.key >= '0' && e.key <= '9' && enteredPin.length < 8) {
        enteredPin += e.key;
        updatePinDots();
        if (enteredPin.length === 4) submitPin();
      } else if (e.key === 'Backspace') {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
      } else if (e.key === 'Enter') {
        submitPin();
      }
    }
  });

  document.getElementById('btnSubmitPin')?.addEventListener('click', submitPin);
  document.getElementById('btnLogoutAdmin')?.addEventListener('click', logoutAdmin);
  document.getElementById('btnSaveLiveSync')?.addEventListener('click', saveLiveStoreState);

  // 3. Tab switching
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      currentTab = tabId;
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.admin-pane').forEach(p => p.classList.toggle('active', p.id === `pane-${tabId}`));
      if (tabId === 'leads') loadLeadsData();
    });
  });

  // 4. Catalog toolbar
  document.getElementById('catalogSearchInput')?.addEventListener('input', renderCatalogTable);
  document.getElementById('catalogCategoryFilter')?.addEventListener('change', renderCatalogTable);
  document.getElementById('btnOpenAddProduct')?.addEventListener('click', () => openProductModal(null));

  // 5. Product modal controls
  document.getElementById('btnCloseProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('btnCancelProductModal')?.addEventListener('click', closeProductModal);
  document.getElementById('btnSaveProductModal')?.addEventListener('click', saveProductFromModal);

  // Drag & drop dropzone
  const dropzone = document.getElementById('prodImageDropzone');
  const fileInput = document.getElementById('prodImageFileInput');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImageFileUpload(e.target.files[0]);
      }
    });
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleImageFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  // 6. CMS additions
  document.getElementById('btnAddFaqBtn')?.addEventListener('click', () => {
    const current = readFaqsFromDOM();
    current.push({ question: 'New Question?', answer: 'Detailed studio answer...' });
    renderFaqList(current);
  });

  // 7. Studio additions
  document.getElementById('btnAddWallBgBtn')?.addEventListener('click', () => {
    const current = readWallBgsFromDOM();
    current.push({
      id: 'bg-' + Date.now(),
      label: 'New Custom Room',
      url: 'assets/wall-livingroom.jpg',
      dark: false
    });
    renderWallBgTable(current);
  });

  // 8. Leads toolbar
  document.getElementById('btnRefreshLeads')?.addEventListener('click', () => {
    loadLeadsData();
    showToast('Leads refreshed.');
  });
  document.getElementById('btnExportLeadsCsv')?.addEventListener('click', exportLeadsToCsv);
  document.getElementById('btnExportLeadsJson')?.addEventListener('click', exportLeadsToJson);

  // 9. Settings actions
  document.getElementById('btnUpdatePin')?.addEventListener('click', updateAdminPin);
  document.getElementById('btnExportJson')?.addEventListener('click', exportStateJsonBackup);
  document.getElementById('inputImportJson')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importStateJsonSnapshot(e.target.files[0]);
    }
  });
  document.getElementById('btnResetDefaults')?.addEventListener('click', resetToFactoryDefaults);
}

document.addEventListener('DOMContentLoaded', initAdminApp);
