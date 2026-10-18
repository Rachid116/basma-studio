/**
 * BASMA (@basma.llb) — Unified Persistent Store State & Cloud Sync Service
 * Synchronizes Admin CMS edits across LocalStorage, Serverless Vercel API (/api/store-state),
 * static store-state.json fallback, and optional Cloud Webhook URLs.
 */

import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../data/products.js';
import { DEFAULT_PIN_SHA256, sha256Hex } from '../utils/security.js';
import { CURRENCIES } from '../utils/priceFormatter.js';
import { escapeHtml } from '../utils/sanitize.js';

const STORAGE_KEY = 'basma_cms_unified_state_v3';

export const storeState = {
  settings: { ...DEFAULT_SETTINGS },
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
  inlineEdits: {},
  products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
  currentCurrencyIndex: 0,
  currentLang: 'en',
  cart: [
    {
      cartItemId: 'init-1',
      productId: 'prod-aero-gt',
      title: 'Aero GT Hypercar Wall Silhouette',
      style: 'Matte Wood Cutout',
      sizeLabel: 'Medium — 80 × 45 cm',
      finish: 'Matte Carbon Black',
      priceUSD: 94,
      qty: 1,
      image: 'assets/product-supercar-wall.jpg',
      isCustom: false
    }
  ]
};

const listeners = new Set();

export function subscribeStore(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyStoreListeners() {
  listeners.forEach(fn => {
    try { fn(storeState); } catch (_) {}
  });
}

export function getStoreSnapshot() {
  // Never serialize plaintext adminPin into snapshots; only store SHA-256 hash
  const safeSettings = { ...storeState.settings };
  delete safeSettings.adminPin;
  if (!safeSettings.adminPinHash) {
    safeSettings.adminPinHash = DEFAULT_PIN_SHA256;
  }
  return {
    version: '2026.3.0',
    updatedAt: new Date().toISOString(),
    categories: storeState.categories,
    settings: safeSettings,
    inlineEdits: storeState.inlineEdits,
    products: storeState.products
  };
}

export async function applyStoreSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (snapshot.settings && typeof snapshot.settings === 'object') {
    const merged = { ...DEFAULT_SETTINGS, ...snapshot.settings };
    // Migrate legacy plaintext adminPin if present into SHA-256 hash
    if (merged.adminPin && !snapshot.settings.adminPinHash) {
      merged.adminPinHash = await sha256Hex(String(merged.adminPin));
    }
    delete merged.adminPin;
    storeState.settings = merged;
  }
  if (Array.isArray(snapshot.categories) && snapshot.categories.length > 0) {
    storeState.categories = snapshot.categories;
  }
  if (snapshot.inlineEdits && typeof snapshot.inlineEdits === 'object') {
    storeState.inlineEdits = { ...snapshot.inlineEdits };
  }
  if (Array.isArray(snapshot.products) && snapshot.products.length > 0) {
    storeState.products = snapshot.products;
  }

  CURRENCIES[0].symbol = storeState.settings.primaryCurrencySymbol || '$';
  CURRENCIES[0].label = storeState.settings.primaryCurrencyLabel || 'USD $';

  // 1. Dynamic WhatsApp, Phone, and Email links
  const cleanWa = (storeState.settings.whatsappNumber || '96170360671').replace(/[^0-9]/g, '');
  const floatWa = document.getElementById('floatingWhatsAppLink');
  if (floatWa) floatWa.href = `https://wa.me/${cleanWa}`;
  document.querySelectorAll('[data-dynamic-wa], #footerWhatsAppLink').forEach(el => {
    el.href = `https://wa.me/${cleanWa}`;
  });
  document.querySelectorAll('[data-dynamic-tel], #footerPhoneCallLink, #mobilePhoneLink').forEach(el => {
    el.href = `tel:+${cleanWa}`;
  });
  if (storeState.settings.studioEmail) {
    document.querySelectorAll('[data-dynamic-email], #footerEmailLink, #mobileEmailLink').forEach(el => {
      el.href = `mailto:${storeState.settings.studioEmail}`;
    });
  }

  // 2. Dynamic Promo / Discount Banner
  const promo = storeState.settings.promoBanner;
  let banner = document.getElementById('siteAnnouncementBar');
  if (promo && promo.active && promo.text) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'siteAnnouncementBar';
      banner.className = 'site-announcement-bar';
      document.body.prepend(banner);
    }
    banner.style.display = 'flex';
    banner.innerHTML = `
      <div class="announcement-inner">
        <span class="announcement-badge">${escapeHtml(promo.badge || 'PROMO')}</span>
        <span class="announcement-text">${escapeHtml(promo.text)}</span>
        ${promo.link ? `<a href="${escapeHtml(promo.link)}" class="announcement-link">Explore Now →</a>` : ''}
      </div>
    `;
  } else if (banner) {
    banner.style.display = 'none';
  }

  // 3. Dynamic CMS Homepage Copy
  const cms = storeState.settings.cmsContent;
  if (cms) {
    if (cms.hero) {
      const heroTitle = document.querySelector('.hero-title');
      const heroSubtitle = document.querySelector('.hero-subtitle');
      const heroBadge = document.querySelector('.hero-section .argon-badge span:last-child');
      if (heroTitle && cms.hero.headline) heroTitle.innerHTML = cms.hero.headline;
      if (heroSubtitle && cms.hero.subheadline) heroSubtitle.textContent = cms.hero.subheadline;
      if (heroBadge && cms.hero.goldBadge) heroBadge.textContent = cms.hero.goldBadge;
      if (cms.hero.image1) {
        const slideImg1 = document.querySelector('#slideSilhouette img');
        if (slideImg1) slideImg1.src = cms.hero.image1;
      }
      if (cms.hero.image2) {
        const slideImg2 = document.querySelector('#slideRelief img');
        if (slideImg2) slideImg2.src = cms.hero.image2;
      }
    }
    if (Array.isArray(cms.craftSteps) && cms.craftSteps.length === 3) {
      const craftCards = document.querySelectorAll('.craft-card');
      cms.craftSteps.forEach((step, i) => {
        if (craftCards[i]) {
          const h3 = craftCards[i].querySelector('h3');
          const p = craftCards[i].querySelector('p');
          if (h3 && step.title) h3.innerHTML = step.title;
          if (p && step.description) p.innerHTML = step.description;
        }
      });
    }
  }

  // 4. Dynamic SEO Title & Meta
  if (storeState.settings.seoMeta?.title && typeof document !== 'undefined') {
    document.title = storeState.settings.seoMeta.title;
  }

  notifyStoreListeners();
}

export async function loadPersistentStoreState() {
  let loadedFromLocal = false;
  try {
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (savedRaw) {
      const parsed = JSON.parse(savedRaw);
      await applyStoreSnapshot(parsed);
      loadedFromLocal = true;
    }
  } catch (_) {}

  // Try serverless API /api/store-state first, then fallback to /store-state.json
  try {
    const apiResp = await fetch('/api/store-state', { cache: 'no-store' });
    if (apiResp.ok) {
      const remoteData = await apiResp.json();
      if (!loadedFromLocal && remoteData && remoteData.products) {
        await applyStoreSnapshot(remoteData);
        return;
      }
    }
  } catch (_) {}

  if (!loadedFromLocal) {
    try {
      const resp = await fetch('/store-state.json', { cache: 'no-store' });
      if (resp.ok) {
        const fallbackData = await resp.json();
        await applyStoreSnapshot(fallbackData);
      }
    } catch (_) {}
  }
}

export async function savePersistentStoreState() {
  const snapshot = getStoreSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {}

  // Push to Vercel Serverless API (/api/store-state)
  try {
    fetch('/api/store-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    }).catch(() => {});
  } catch (_) {}

  // Push to optional Cloud Webhook URL if configured
  if (storeState.settings.cloudWebhookUrl && storeState.settings.cloudWebhookUrl.startsWith('http')) {
    try {
      fetch(storeState.settings.cloudWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      }).catch(() => {});
    } catch (_) {}
  }

  const syncBadge = document.getElementById('adminSyncBadge');
  if (syncBadge) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    syncBadge.textContent = `✓ Synced Live at ${timeStr}`;
  }
}

export async function resetStoreToFactoryDefaults() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  storeState.settings = { ...DEFAULT_SETTINGS };
  storeState.inlineEdits = {};
  storeState.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  await applyStoreSnapshot(getStoreSnapshot());
  await savePersistentStoreState();
}
