/**
 * BASMA (@basma.llb) — /api/store-state
 * Persists and returns the entire store state (products, pricing, CMS text, customizer options, store settings).
 * Integrates with storage adapter: Vercel KV (cloud persistent), local disk, or fallback.
 */

const fs = require('fs');
const path = require('path');
const storage = require('./_lib/storage');
const { send, readJsonBody } = require('./_lib/http');

const STATE_STORAGE_KEY = 'main_store';
const LEGACY_STATE_KEY = 'basma:store_state';
const ROOT_STATE_FILE = path.join(process.cwd(), 'store-state.json');
const PUBLIC_STATE_FILE = path.join(process.cwd(), 'public', 'store-state.json');
const INITIAL_DATA_FILE = path.join(process.cwd(), 'src', 'data', 'initialStoreData.json');

async function loadBaselineState() {
  // 1. Try primary storage adapter key ('main_store')
  try {
    const fromStorage = await storage.getJSON(STATE_STORAGE_KEY);
    if (fromStorage && typeof fromStorage === 'object' && Array.isArray(fromStorage.products)) {
      return fromStorage;
    }
  } catch (_) {}

  // 1b. Try legacy key ('basma:store_state')
  try {
    const fromLegacy = await storage.getJSON(LEGACY_STATE_KEY);
    if (fromLegacy && typeof fromLegacy === 'object' && Array.isArray(fromLegacy.products)) {
      return fromLegacy;
    }
  } catch (_) {}

  // 2. Try root store-state.json file
  try {
    if (fs.existsSync(ROOT_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(ROOT_STATE_FILE, 'utf8'));
    }
  } catch (_) {}

  // 3. Try public/store-state.json
  try {
    if (fs.existsSync(PUBLIC_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(PUBLIC_STATE_FILE, 'utf8'));
    }
  } catch (_) {}

  // 4. Try src/data/initialStoreData.json zero-failure fallback
  try {
    if (fs.existsSync(INITIAL_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(INITIAL_DATA_FILE, 'utf8'));
    }
  } catch (_) {}

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Basma-Admin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // GET: Return current live store state
  if (req.method === 'GET') {
    const state = await loadBaselineState();
    if (!state) {
      return send(res, 404, { ok: false, error: 'Store state file not found' });
    }
    // Never leak plaintext admin PIN in public state
    if (state.settings && state.settings.adminPin) {
      delete state.settings.adminPin;
    }
    state.backend = storage.backend();
    state.isPersistent = storage.isPersistent();
    return send(res, 200, state);
  }

  // POST: Save updated store state
  if (req.method === 'POST') {
    try {
      const payload = await readJsonBody(req, 15 * 1024 * 1024);
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.products)) {
        return send(res, 400, { ok: false, error: 'Invalid store state payload: expected products array' });
      }

      // Security sanitization: never store plaintext PIN in settings
      if (payload.settings && payload.settings.adminPin) {
        delete payload.settings.adminPin;
      }

      // If a valid custom adminPinHash is present, sync with auth record
      if (payload.settings && payload.settings.adminPinHash && /^[a-f0-9]{64}$/i.test(payload.settings.adminPinHash)) {
        try {
          const authLib = require('./_lib/auth');
          const authRec = await authLib.getAuthRecord();
          await authLib.setPin(authRec, payload.settings.adminPinHash.toLowerCase());
        } catch (_) {}
      }

      payload.updatedAt = new Date().toISOString();

      // Save to primary storage adapter (KV / disk)
      try {
        await storage.setJSON(STATE_STORAGE_KEY, payload);
      } catch (_) {}

      // Also mirror to local filesystem if writable
      const serialized = JSON.stringify(payload, null, 2);
      try {
        fs.writeFileSync(ROOT_STATE_FILE, serialized, 'utf8');
      } catch (_) {}
      try {
        fs.writeFileSync(PUBLIC_STATE_FILE, serialized, 'utf8');
      } catch (_) {}

      return send(res, 200, {
        ok: true,
        backend: storage.backend(),
        isPersistent: storage.isPersistent(),
        syncedAt: payload.updatedAt,
        message: 'Store state saved and synced live'
      });
    } catch (err) {
      return send(res, 400, { ok: false, error: err.message || 'Malformed JSON payload' });
    }
  }

  return send(res, 405, { ok: false, error: 'Method not allowed' });
};
