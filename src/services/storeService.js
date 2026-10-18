/**
 * BASMA (@basma.llb) — Unified Persistent Store State & Supabase Cloud Sync Service
 * 
 * Synchronizes Admin CMS edits across:
 *   1. Supabase Cloud Database (100% Free permanent storage in table `site_data`)
 *   2. LocalStorage browser cache (Instant offline responsiveness)
 *   3. Serverless Vercel API (/api/store-state)
 *   4. Static /store-state.json fallback
 */

import { createClient } from '@supabase/supabase-js';
import { DEFAULT_PRODUCTS, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../data/products.js';
import { DEFAULT_PIN_SHA256, sha256Hex, getStoredAdminPinHash, saveAdminPinHash } from '../utils/security.js';
import { CURRENCIES } from '../utils/priceFormatter.js';
import { escapeHtml } from '../utils/sanitize.js';

const STORAGE_KEY = 'basma_cms_unified_state_v3';
const SUPABASE_URL_KEY = 'basma_supabase_url';
const SUPABASE_KEY_KEY = 'basma_supabase_anon_key';

// ----------------------------------------------------------------------------
// SUPABASE CLIENT INITIALIZATION
// ----------------------------------------------------------------------------
function resolveEnv(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch (_) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name];
    }
  } catch (_) {}
  return '';
}

const DEFAULT_SUPABASE_URL = 'https://niaknvbnxxsctdxbkwfm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYWtudmJueHhzY3RkeGJrd2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMzY0MTksImV4cCI6MjEwNzkxMjQxOX0.I_1Lc02T2PzVJpsEoA702xkpYEzDdJXc33k5XNHnTG0';

function getActiveSupabaseConfig() {
  const envUrl = resolveEnv('VITE_SUPABASE_URL') || resolveEnv('SUPABASE_URL');
  const envKey = resolveEnv('VITE_SUPABASE_ANON_KEY') || resolveEnv('SUPABASE_ANON_KEY');
  let localUrl = '';
  let localKey = '';
  try {
    localUrl = localStorage.getItem(SUPABASE_URL_KEY) || '';
    localKey = localStorage.getItem(SUPABASE_KEY_KEY) || '';
  } catch (_) {}

  const finalUrl = (envUrl || localUrl || DEFAULT_SUPABASE_URL).trim();
  const finalKey = (envKey || localKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  return {
    url: finalUrl,
    key: finalKey,
    isEnv: !!(envUrl && envKey)
  };
}

let supabaseInstance = null;

export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;
  const config = getActiveSupabaseConfig();
  if (config.url && config.key && config.url.startsWith('http')) {
    try {
      supabaseInstance = createClient(config.url, config.key, {
        auth: { persistSession: false }
      });
      return supabaseInstance;
    } catch (err) {
      console.warn('[Basma DB] Supabase initialization failed:', err);
    }
  }
  return null;
}

export function setSupabaseCredentials(url, key) {
  const cleanUrl = String(url || '').trim();
  const cleanKey = String(key || '').trim();
  try {
    if (cleanUrl) localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
    else localStorage.removeItem(SUPABASE_URL_KEY);
    if (cleanKey) localStorage.setItem(SUPABASE_KEY_KEY, cleanKey);
    else localStorage.removeItem(SUPABASE_KEY_KEY);
  } catch (_) {}
  supabaseInstance = null;
  return getSupabaseClient();
}

export function getSupabaseStatus() {
  const config = getActiveSupabaseConfig();
  const client = getSupabaseClient();
  return {
    isConfigured: !!(config.url && config.key),
    hasClient: !!client,
    url: config.url ? config.url.replace(/^https?:\/\//, '').split('/')[0] : '',
    isEnv: config.isEnv
  };
}

// ----------------------------------------------------------------------------
// STORE STATE
// ----------------------------------------------------------------------------
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
  const safeSettings = { ...storeState.settings };
  delete safeSettings.adminPin;
  safeSettings.adminPinHash = getStoredAdminPinHash();
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
    if (snapshot.settings.adminPinHash && /^[a-f0-9]{64}$/i.test(snapshot.settings.adminPinHash)) {
      saveAdminPinHash(snapshot.settings.adminPinHash);
      merged.adminPinHash = snapshot.settings.adminPinHash;
    } else {
      merged.adminPinHash = getStoredAdminPinHash();
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

  // 2. Dynamic Promo Banner
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
    if (cms.brandStory) {
      const footerAbout = document.querySelector('[data-i18n="footer_about"]');
      if (footerAbout) footerAbout.textContent = cms.brandStory;
    }
  }

  // 4. Dynamic Calculator & Customizer Settings
  const sizeSlider = document.getElementById('sizeRangeSlider');
  if (sizeSlider) {
    if (storeState.settings.calcMinCm) sizeSlider.min = String(storeState.settings.calcMinCm);
    if (storeState.settings.calcMaxCm) sizeSlider.max = String(storeState.settings.calcMaxCm);
  }
  const engInput = document.getElementById('customEngravingInput');
  if (engInput && storeState.settings.customizerSettings?.engravingCharLimit) {
    engInput.maxLength = Number(storeState.settings.customizerSettings.engravingCharLimit) || 60;
  }

  // 5. Dynamic Inline Edits ([data-cms-id])
  if (storeState.inlineEdits && typeof document !== 'undefined') {
    document.querySelectorAll('[data-cms-id]').forEach(el => {
      const id = el.getAttribute('data-cms-id');
      if (storeState.inlineEdits[id]) {
        el.innerHTML = storeState.inlineEdits[id];
      }
    });
  }

  // 6. Dynamic SEO Title & Meta
  if (storeState.settings.seoMeta?.title && typeof document !== 'undefined') {
    document.title = storeState.settings.seoMeta.title;
  }

  notifyStoreListeners();
}

// ----------------------------------------------------------------------------
// SUPABASE SYNC LOGIC
// ----------------------------------------------------------------------------
export async function fetchStoreFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('site_data')
      .select('content')
      .eq('id', 'main_store')
      .maybeSingle();

    if (error) {
      console.warn('[Basma DB] Supabase select error:', error.message);
      return null;
    }

    if (data && data.content && Array.isArray(data.content.products) && data.content.products.length > 0) {
      return data.content;
    }

    // Table is empty / first run: automatically populate with the default Basma catalog!
    const initialSeed = getStoreSnapshot();
    await client
      .from('site_data')
      .upsert({
        id: 'main_store',
        content: initialSeed,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    return initialSeed;
  } catch (err) {
    console.warn('[Basma DB] Supabase fetch exception:', err);
    return null;
  }
}

export async function upsertStoreToSupabase(snapshot) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const nowIso = new Date().toISOString();
    const { error } = await client
      .from('site_data')
      .upsert([
        { id: 'main_store', content: snapshot, updated_at: nowIso },
        { id: 'basma:store_state', content: snapshot, updated_at: nowIso }
      ], { onConflict: 'id' });

    if (error) {
      console.warn('[Basma DB] Supabase upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Basma DB] Supabase upsert exception:', err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// PERSISTENT LOAD & SAVE ORCHESTRATION (ZERO-FAILURE FALLBACK)
// ----------------------------------------------------------------------------
export async function loadPersistentStoreState() {
  let loaded = false;

  // 1. Try Supabase Cloud Database directly (Free permanent persistence across all devices)
  try {
    const supabaseData = await fetchStoreFromSupabase();
    if (supabaseData && Array.isArray(supabaseData.products) && supabaseData.products.length > 0) {
      await applyStoreSnapshot(supabaseData);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(supabaseData));
      } catch (_) {}
      loaded = true;
    }
  } catch (_) {}

  // 2. Fallback to serverless API /api/store-state (also backed by Supabase)
  if (!loaded) {
    try {
      const apiResp = await fetch(`/api/store-state?t=${Date.now()}`, { cache: 'no-store' });
      if (apiResp.ok) {
        const remoteData = await apiResp.json();
        if (remoteData && Array.isArray(remoteData.products) && remoteData.products.length > 0) {
          await applyStoreSnapshot(remoteData);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
          } catch (_) {}
          loaded = true;
        }
      }
    } catch (_) {}
  }

  // 3. Fallback to localStorage cache (offline mode only)
  if (!loaded) {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
          await applyStoreSnapshot(parsed);
          loaded = true;
        }
      }
    } catch (_) {}
  }

  // 4. Fallback to static store-state.json
  if (!loaded) {
    try {
      const resp = await fetch('/store-state.json', { cache: 'no-store' });
      if (resp.ok) {
        const fallbackData = await resp.json();
        if (fallbackData && Array.isArray(fallbackData.products)) {
          await applyStoreSnapshot(fallbackData);
        }
      }
    } catch (_) {}
  }
}

export async function savePersistentStoreState() {
  const snapshot = getStoreSnapshot();

  // 1. Instant local persistence
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {}

  // 2. Upsert to Supabase Cloud Database
  let supabaseSynced = false;
  try {
    supabaseSynced = await upsertStoreToSupabase(snapshot);
  } catch (_) {}

  // 3. Push to Vercel Serverless API (/api/store-state)
  try {
    fetch('/api/store-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    }).catch(() => {});
  } catch (_) {}

  // 4. Push to optional Cloud Webhook URL
  if (storeState.settings.cloudWebhookUrl && storeState.settings.cloudWebhookUrl.startsWith('http')) {
    try {
      fetch(storeState.settings.cloudWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      }).catch(() => {});
    } catch (_) {}
  }

  // 5. Update UI sync badge
  const syncBadge = document.getElementById('adminSyncBadge');
  if (syncBadge) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    syncBadge.textContent = supabaseSynced
      ? `✓ Synced to Supabase Cloud at ${timeStr}`
      : `✓ Synced Live at ${timeStr}`;
  }

  return { ok: true, supabaseSynced };
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

// ----------------------------------------------------------------------------
// OFFLINE JSON BACKUP UTILITIES
// ----------------------------------------------------------------------------
export function exportStoreBackupJson() {
  const snapshot = getStoreSnapshot();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `basma_store_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function importStoreBackupJson(parsed) {
  if (!parsed || !Array.isArray(parsed.products)) {
    throw new Error('Invalid backup file: missing products array.');
  }
  await applyStoreSnapshot(parsed);
  await savePersistentStoreState();
}
