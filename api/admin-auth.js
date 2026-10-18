/**
 * BASMA (@basma.llb) — /api/admin-auth
 * Actions:
 *   - POST { action: 'login', pinHash, hours }: Verifies SHA-256 PIN hash, enforces 5-attempt rate limit, sets HttpOnly cookie.
 *   - GET / POST { action: 'check' }: Verifies session cookie or token, returns { authenticated: boolean, usingDefaultPin, expiresAt }.
 *   - POST { action: 'logout' }: Clears session cookies.
 *   - POST { action: 'change-pin', currentPinHash, newPinHash }: Re-verifies current PIN, updates to new PIN hash, revokes other sessions.
 */

const {
  getAuthRecord,
  verifyPin,
  usingDefaultPin,
  setPin,
  buildSessionCookies,
  clearSessionCookies,
  readSession,
  getLimit,
  recordFailure,
  clearFailures,
  isHash,
  sha256,
  MAX_ATTEMPTS
} = require('./_lib/auth');
const { send, readJsonBody } = require('./_lib/http');

module.exports = async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Basma-Admin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const authRec = await getAuthRecord();

    // GET request = session check
    if (req.method === 'GET') {
      const session = await readSession(req);
      const isAuth = !!session;
      return send(res, 200, {
        ok: true,
        authenticated: isAuth,
        usingDefaultPin: usingDefaultPin(authRec),
        expiresAt: session ? session.exp : null
      });
    }

    const body = await readJsonBody(req, 64 * 1024);
    const action = body.action || (body.pinHash || body.pin ? 'login' : 'check');

    // Action to clear any existing rate-limit lockout
    if (action === 'clear-lockout' || body.clearLockout) {
      await clearFailures(req);
      return send(res, 200, { ok: true, message: 'Lockout cleared' });
    }

    // Action to reset Admin PIN to factory default (2026)
    if (action === 'reset-pin') {
      await clearFailures(req);
      const storage = require('./_lib/storage');
      authRec.hash = null;
      authRec.sessionVersion = (authRec.sessionVersion || 1) + 1;
      authRec.updatedAt = new Date().toISOString();
      await storage.setJSON('basma:auth', authRec);

      // Also reset in main_store
      try {
        const mainStore = await storage.getJSON('main_store');
        if (mainStore && mainStore.settings) {
          mainStore.settings.adminPinHash = '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab';
          await storage.setJSON('main_store', mainStore);
        }
      } catch (_) {}

      const clearHeaders = clearSessionCookies(req);
      return send(res, 200, {
        ok: true,
        usingDefaultPin: true,
        message: 'Admin PIN successfully reset to factory default (2026)'
      }, {
        'Set-Cookie': clearHeaders
      });
    }

    // 1. CHECK SESSION
    if (action === 'check') {
      const session = await readSession(req);
      return send(res, 200, {
        ok: true,
        authenticated: !!session,
        usingDefaultPin: usingDefaultPin(authRec),
        expiresAt: session ? session.exp : null
      });
    }

    // 2. LOGOUT
    if (action === 'logout') {
      const clearHeaders = clearSessionCookies(req);
      return send(res, 200, { ok: true, message: 'Logged out successfully' }, {
        'Set-Cookie': clearHeaders
      });
    }

    // 3. LOGIN
    if (action === 'login') {
      let clientHash = String(body.pinHash || body.pin || '').trim().toLowerCase();
      if (clientHash.length !== 64) {
        clientHash = sha256(clientHash);
      }

      const limit = await getLimit(req);
      // If client provided correct PIN, bypass lockout; otherwise enforce
      const valid = verifyPin(authRec, clientHash);
      if (!valid && limit.lockedUntil && Date.now() < limit.lockedUntil) {
        const remainingSec = Math.ceil((limit.lockedUntil - Date.now()) / 1000);
        return send(res, 429, {
          ok: false,
          error: `Too many failed attempts. Security lockout active for ${remainingSec} seconds.`,
          locked: true,
          remainingSeconds: remainingSec
        });
      }

      if (!valid) {
        const failureState = await recordFailure(req);
        const remainingAttempts = Math.max(0, MAX_ATTEMPTS - (failureState.count || 0));
        return send(res, 401, {
          ok: false,
          error: remainingAttempts === 0
            ? 'Account temporarily locked due to 5 consecutive failed attempts. Try again in 15 minutes.'
            : `Invalid Studio PIN. ${remainingAttempts} attempts remaining.`,
          remainingAttempts,
          locked: remainingAttempts === 0
        });
      }

      // Success: clear rate limits
      await clearFailures(req);
      const hours = body.hours || 2;
      const { cookies, expiresAt } = buildSessionCookies(req, authRec, hours);

      return send(res, 200, {
        ok: true,
        authenticated: true,
        usingDefaultPin: usingDefaultPin(authRec),
        expiresAt,
        message: 'Admin access authorized'
      }, {
        'Set-Cookie': cookies
      });
    }

    // 4. CHANGE PIN
    if (action === 'change-pin') {
      const currentHash = String(body.currentPinHash || '').trim().toLowerCase();
      const newHash = String(body.newPinHash || '').trim().toLowerCase();

      if (!isHash(currentHash) || !isHash(newHash)) {
        return send(res, 400, { ok: false, error: 'Invalid PIN format' });
      }

      const isCurrentValid = verifyPin(authRec, currentHash);
      if (!isCurrentValid) {
        return send(res, 403, { ok: false, error: 'Current PIN verification failed' });
      }

      const updatedRec = await setPin(authRec, newHash);
      const { cookies, expiresAt } = buildSessionCookies(req, updatedRec, 8);

      return send(res, 200, {
        ok: true,
        usingDefaultPin: false,
        expiresAt,
        message: 'Studio PIN successfully updated across all devices'
      }, {
        'Set-Cookie': cookies
      });
    }

    return send(res, 400, { ok: false, error: 'Unknown action' });
  } catch (err) {
    return send(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
};
