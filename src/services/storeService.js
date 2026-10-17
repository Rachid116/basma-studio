/**
 * BASMA (@basma.llb) — Unified Persistent Store State & Cloud Sync Service
 * Synchronizes Admin CMS edits across LocalStorage, Serverless Vercel API (/api/store-state),
 * static store-state.json fallback, and optional Cloud Webhook URLs.
 */

import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS } from '../data/products.js';
import { DEFAULT_PIN_SHA256, sha256Hex } from '../utils/security.js';
import { CURRENCIES } from '../utils/priceFormatter.js';

const STORAGE_KEY = 'basma_cms_unified_state_v3';

export const storeState = {
  settings: { ...DEFAULT_SETTINGS },
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
  if (snapshot.inlineEdits && typeof snapshot.inlineEdits === 'object') {
    storeState.inlineEdits = { ...snapshot.inlineEdits };
  }
  if (Array.isArray(snapshot.products) && snapshot.products.length > 0) {
    storeState.products = snapshot.products;
  }

  CURRENCIES[0].symbol = storeState.settings.primaryCurrencySymbol || '$';
  CURRENCIES[0].label = storeState.settings.primaryCurrencyLabel || 'USD $';

  // Update floating WhatsApp link & footer contact links
  const cleanWa = (storeState.settings.whatsappNumber || '96170360671').replace(/[^0-9]/g, '');
  const floatWa = document.getElementById('floatingWhatsAppLink');
  if (floatWa) floatWa.href = `https://wa.me/${cleanWa}`;
  document.querySelectorAll('[data-dynamic-wa]').forEach(el => {
    el.href = `https://wa.me/${cleanWa}`;
  });
  document.querySelectorAll('[data-dynamic-tel]').forEach(el => {
    el.href = `tel:+${cleanWa}`;
  });

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
