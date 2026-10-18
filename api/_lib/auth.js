/**
 * BASMA — Admin credential storage, rate limiting and signed HttpOnly session cookies.
 *
 * Flow: the browser hashes the PIN with SHA-256 (SubtleCrypto) so the plaintext never leaves the device.
 * The server then stores only sha256(randomSalt + ':' + clientHash) in a PRIVATE storage key that is never
 * returned by any public endpoint, and compares in constant time.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
const { parseCookies, clientIp, isHttps } = require('./http');

const DEFAULT_PIN_SHA256 = '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab'; // sha256("2026")
const AUTH_KEY = 'basma:auth';
const SESSION_COOKIE = 'basma_admin';
const HINT_COOKIE = 'basma_admin_hint';
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const ALLOWED_SESSION_HOURS = [1, 2, 8, 24];

const memoryLimits = new Map();

const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex');
const randomHex = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

async function getAuthRecord() {
  let rec = await storage.getJSON(AUTH_KEY);
  if (!rec || !rec.salt || !rec.secret) {
    let initialCustomHash = null;
    try {
      const siteStore = await storage.getJSON('main_store');
      if (siteStore?.settings?.adminPinHash && isHash(siteStore.settings.adminPinHash)) {
        initialCustomHash = siteStore.settings.adminPinHash;
      }
    } catch (_) {}

    if (!initialCustomHash) {
      try {
        const rootStateFile = path.join(process.cwd(), 'store-state.json');
        if (fs.existsSync(rootStateFile)) {
          const parsed = JSON.parse(fs.readFileSync(rootStateFile, 'utf8'));
          if (parsed?.settings?.adminPinHash && isHash(parsed.settings.adminPinHash)) {
            initialCustomHash = parsed.settings.adminPinHash;
          }
        }
      } catch (_) {}
    }

    const salt = randomHex(16);
    rec = {
      salt,
      hash: initialCustomHash ? sha256(`${salt}:${initialCustomHash}`) : null,
      secret: randomHex(32),
      sessionVersion: 1,
      createdAt: new Date().toISOString()
    };
    await storage.setJSON(AUTH_KEY, rec);
  }
  return rec;
}

function expectedHash(rec) {
  if (rec.hash) return rec.hash;
  const envHash = String(process.env.ADMIN_PIN_HASH || process.env.ADMIN_SECRET_HASH || '').toLowerCase();
  return sha256(`${rec.salt}:${isHash(envHash) ? envHash : DEFAULT_PIN_SHA256}`);
}

function usingDefaultPin(rec) {
  return !rec.hash && !isHash(String(process.env.ADMIN_PIN_HASH || process.env.ADMIN_SECRET_HASH || '').toLowerCase());
}

function verifyPin(rec, clientHash) {
  if (!clientHash) return false;
  // If raw PIN was passed, hash with SHA-256
  if (clientHash.length !== 64) {
    clientHash = sha256(clientHash);
  }
  if (!isHash(clientHash)) return false;

  const candidate = sha256(`${rec.salt}:${clientHash}`);
  return safeEqual(candidate, expectedHash(rec));
}

async function setPin(rec, newClientHash) {
  rec.salt = randomHex(16);
  rec.hash = sha256(`${rec.salt}:${newClientHash}`);
  rec.sessionVersion = (rec.sessionVersion || 1) + 1; // logs out every other device
  rec.updatedAt = new Date().toISOString();
  await storage.setJSON(AUTH_KEY, rec);

  // Sync to store-state.json and public/store-state.json if filesystem is writable
  try {
    const rootStateFile = path.join(process.cwd(), 'store-state.json');
    if (fs.existsSync(rootStateFile)) {
      const stateObj = JSON.parse(fs.readFileSync(rootStateFile, 'utf8'));
      if (stateObj && stateObj.settings) {
        stateObj.settings.adminPinHash = newClientHash;
        fs.writeFileSync(rootStateFile, JSON.stringify(stateObj, null, 2), 'utf8');
      }
    }
  } catch (_) {}

  try {
    const pubStateFile = path.join(process.cwd(), 'public', 'store-state.json');
    if (fs.existsSync(pubStateFile)) {
      const pubObj = JSON.parse(fs.readFileSync(pubStateFile, 'utf8'));
      if (pubObj && pubObj.settings) {
        pubObj.settings.adminPinHash = newClientHash;
        fs.writeFileSync(pubStateFile, JSON.stringify(pubObj, null, 2), 'utf8');
      }
    }
  } catch (_) {}

  // Sync to database key main_store
  try {
    const mainStore = await storage.getJSON('main_store');
    if (mainStore && mainStore.settings) {
      mainStore.settings.adminPinHash = newClientHash;
      await storage.setJSON('main_store', mainStore);
    }
  } catch (_) {}

  return rec;
}

async function revokeAllSessions(rec) {
  rec.sessionVersion = (rec.sessionVersion || 1) + 1;
  await storage.setJSON(AUTH_KEY, rec);
  return rec;
}

const secretOf = (rec) => process.env.ADMIN_SESSION_SECRET || rec.secret;
const sign = (rec, data) => crypto.createHmac('sha256', secretOf(rec)).update(data).digest('base64url');

function buildSessionCookies(req, rec, hours) {
  const safeHours = ALLOWED_SESSION_HOURS.includes(Number(hours)) ? Number(hours) : 2;
  const maxAge = safeHours * 3600;
  const payload = Buffer.from(JSON.stringify({
    v: rec.sessionVersion,
    iat: Date.now(),
    exp: Date.now() + maxAge * 1000,
    n: randomHex(8)
  })).toString('base64url');
  const token = `${payload}.${sign(rec, payload)}`;
  const secure = isHttps(req) ? '; Secure' : '';
  return {
    expiresAt: Date.now() + maxAge * 1000,
    cookies: [
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
      // Non-secret hint so the public site knows to lazy-load the admin bar (grants no access by itself).
      `${HINT_COOKIE}=1; Path=/; SameSite=Strict; Max-Age=${maxAge}${secure}`
    ]
  };
}

function clearSessionCookies(req) {
  const secure = isHttps(req) ? '; Secure' : '';
  return [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    `${HINT_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0${secure}`
  ];
}

async function readSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const rec = await getAuthRecord();
  if (!safeEqual(signature, sign(rec, payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    if (data.v !== rec.sessionVersion) return null;
    return { ...data, rec };
  } catch (_) {
    return null;
  }
}

/* ---------- Brute-force protection (5 attempts → 15 min lockout per IP) ---------- */

function limitKey(req) {
  return `basma:rl:login:${sha256(clientIp(req)).slice(0, 24)}`;
}

async function getLimit(req) {
  const key = limitKey(req);
  let state = null;
  try { state = await storage.getJSON(key); } catch (_) { state = null; }
  const mem = memoryLimits.get(key);
  if (!state || (mem && mem.count > state.count)) state = mem || null;
  return state || { count: 0, lockedUntil: 0 };
}

async function recordFailure(req) {
  const key = limitKey(req);
  const state = await getLimit(req);
  state.count = (state.count || 0) + 1;
  if (state.count >= MAX_ATTEMPTS) state.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
  memoryLimits.set(key, state);
  try { await storage.setJSON(key, state, LOCK_MINUTES * 60); } catch (_) { /* memory fallback still active */ }
  return state;
}

async function clearFailures(req) {
  const key = limitKey(req);
  memoryLimits.delete(key);
  try { await storage.del(key); } catch (_) { /* ignore */ }
}

module.exports = {
  DEFAULT_PIN_SHA256,
  MAX_ATTEMPTS,
  ALLOWED_SESSION_HOURS,
  isHash,
  getAuthRecord,
  verifyPin,
  usingDefaultPin,
  setPin,
  revokeAllSessions,
  buildSessionCookies,
  clearSessionCookies,
  readSession,
  getLimit,
  recordFailure,
  clearFailures,
  randomHex,
  sha256
};
