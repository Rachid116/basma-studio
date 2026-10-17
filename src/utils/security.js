/**
 * BASMA (@basma.llb) — Cryptographic SHA-256 Admin Authentication, Session & Rate Limiter
 * Never compares or stores plaintext PINs. Enforces 5-attempt lockout protection.
 */

const SESSION_STORAGE_KEY = 'basma_admin_session_token_v2';
const LOCKOUT_STORAGE_KEY = 'basma_admin_rate_limit_v2';

// Pre-computed SHA-256 hash of default studio PIN "2026"
export const DEFAULT_PIN_SHA256 = 'a688c2c38f05246f763409b4520c0aa3ecc3ba304c92af58665f5c636120296d';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout after 5 failed attempts
const SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours session expiry

/**
 * Computes SHA-256 hex digest using Web Crypto API (SubtleCrypto) with pure-JS fallback.
 */
export async function sha256Hex(message) {
  const text = String(message || '').trim();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic hash if SubtleCrypto is unavailable in non-HTTPS local preview
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0, ch; i < text.length; i++) {
    ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function getRateLimitStatus() {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { locked: false, attempts: 0, remainingSeconds: 0 };
    const state = JSON.parse(raw);
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      const remainingSeconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      return { locked: true, attempts: state.attempts || MAX_FAILED_ATTEMPTS, remainingSeconds };
    }
    if (state.lockedUntil && Date.now() >= state.lockedUntil) {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      return { locked: false, attempts: 0, remainingSeconds: 0 };
    }
    return { locked: false, attempts: state.attempts || 0, remainingSeconds: 0 };
  } catch (_) {
    return { locked: false, attempts: 0, remainingSeconds: 0 };
  }
}

export function recordFailedPinAttempt() {
  try {
    const status = getRateLimitStatus();
    const attempts = status.attempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ attempts, lockedUntil }));
    return {
      locked: !!lockedUntil,
      attempts,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempts),
      remainingSeconds: lockedUntil ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0
    };
  } catch (_) {
    return { locked: false, attempts: 1, remainingAttempts: 4, remainingSeconds: 0 };
  }
}

export function clearFailedPinAttempts() {
  try {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch (_) {}
}

export function createAdminSession(pinHash) {
  const token = {
    role: 'basma_studio_admin',
    signature: pinHash.slice(0, 16),
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS
  };
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(token));
  } catch (_) {}
  return token;
}

export function hasValidAdminSession(expectedPinHash = DEFAULT_PIN_SHA256) {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const token = JSON.parse(raw);
    if (!token || token.role !== 'basma_studio_admin') return false;
    if (Date.now() > token.expiresAt) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }
    return token.signature === (expectedPinHash || DEFAULT_PIN_SHA256).slice(0, 16);
  } catch (_) {
    return false;
  }
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (_) {}
}
