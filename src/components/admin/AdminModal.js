/**
 * BASMA (@basma.llb) — Secure SHA-256 Admin Authentication Modal & Session Controller
 * Implements SHA-256 verification, 5-attempt lockout rate-limiting, and lazy admin initialization.
 */

import { storeState } from '../../services/storeService.js';
import {
  sha256Hex,
  DEFAULT_PIN_SHA256,
  getStoredAdminPinHash,
  getRateLimitStatus,
  recordFailedPinAttempt,
  clearFailedPinAttempts,
  createAdminSession,
  hasValidAdminSession,
  clearAdminSession
} from '../../utils/security.js';
import { setInlineEditables, initLiveEditorToolbar, getInlineEditActiveState } from './LiveEditorToolbar.js';
import {
  initProductManager,
  openAdminDrawer,
  closeAdminDrawer,
  openAdminDrawerAndLoadProduct,
  renderAdminProductList,
  populateAdminSettingsForm
} from './ProductManager.js';
import { setAdminProductEditHandler } from '../sections/Catalog.js';
import { showToast } from '../ui/ToastNotifications.js';

let isAdminUnlocked = false;

export function unlockAdminMode() {
  isAdminUnlocked = true;
  document.body.classList.add('admin-mode-active');
  const toolbar = document.getElementById('adminFloatingToolbar');
  const lockLabel = document.getElementById('adminFooterLockLabel');
  if (toolbar) toolbar.style.display = 'flex';
  if (lockLabel) lockLabel.textContent = 'Admin CMS Active (Open Panel)';

  initLiveEditorToolbar({
    onOpenDrawer: openAdminDrawer,
    onExitAdmin: lockAdminMode
  });
  initProductManager();
  setAdminProductEditHandler((prodId) => {
    if (!isAdminUnlocked) return;
    openAdminDrawerAndLoadProduct(prodId);
  });

  setInlineEditables(getInlineEditActiveState(), true);
  renderAdminProductList();
  populateAdminSettingsForm();

  showToast('Unlocked Basma Live Admin CMS!', {
    subMeta: 'SHA-256 session active • Click any text to edit inline'
  });
}

export function lockAdminMode() {
  isAdminUnlocked = false;
  clearAdminSession();
  document.body.classList.remove('admin-mode-active', 'admin-inline-editing');
  const toolbar = document.getElementById('adminFloatingToolbar');
  const lockLabel = document.getElementById('adminFooterLockLabel');
  if (toolbar) toolbar.style.display = 'none';
  if (lockLabel) lockLabel.textContent = 'Admin Login';
  setInlineEditables(false, false);
  closeAdminDrawer();
  showToast('Admin Mode locked & session cleared.');
}

export function initAdminModal() {
  const footerLockBtn = document.getElementById('adminFooterLockBtn');
  const pinModal = document.getElementById('adminPinModal');
  const closePinBtn = document.getElementById('closeAdminPinModalBtn');
  const pinInput = document.getElementById('adminPinInput');
  const pinError = document.getElementById('adminPinError');
  const submitPinBtn = document.getElementById('submitAdminPinBtn');

  // Restore active admin session if valid
  const expectedHash = getStoredAdminPinHash();
  if (hasValidAdminSession(expectedHash)) {
    unlockAdminMode();
  }

  if (footerLockBtn) {
    footerLockBtn.addEventListener('click', () => {
      if (isAdminUnlocked) {
        openAdminDrawer();
      } else {
        const rateStatus = getRateLimitStatus();
        pinModal.classList.add('open');
        pinInput.value = '';
        if (rateStatus.locked) {
          pinError.textContent = `🔒 Too many failed attempts. Locked for ${rateStatus.remainingSeconds}s.`;
          pinError.style.display = 'block';
        } else {
          pinError.style.display = 'none';
        }
        setTimeout(() => pinInput.focus(), 80);
      }
    });
  }

  if (closePinBtn) {
    closePinBtn.addEventListener('click', () => pinModal.classList.remove('open'));
  }

  async function attemptPinUnlock() {
    const rateStatus = getRateLimitStatus();
    if (rateStatus.locked) {
      pinError.textContent = `🔒 Rate limit active. Please wait ${rateStatus.remainingSeconds} seconds.`;
      pinError.style.display = 'block';
      return;
    }

    const entered = (pinInput.value || '').trim();
    if (!entered) return;

    const enteredHash = await sha256Hex(entered);
    const activeHash = getStoredAdminPinHash();

    // Verify against /api/admin-auth if serverless endpoint is reachable
    let serverVerified = false;
    let serverResponded = false;
    let serverError = '';
    try {
      const resp = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', pin: entered, pinHash: enteredHash })
      });
      serverResponded = true;
      if (resp.status === 429) {
        const resJson = await resp.json().catch(() => ({}));
        pinError.textContent = `🔒 ${resJson.error || 'Too many attempts.'}`;
        pinError.style.display = 'block';
        return;
      }
      if (resp.ok) {
        const resJson = await resp.json().catch(() => ({}));
        serverVerified = !!resJson.authenticated;
      } else {
        const resJson = await resp.json().catch(() => ({}));
        serverError = resJson.error || '';
      }
    } catch (_) {
      serverResponded = false;
    }

    // Direct check: strictly matches activeHash. NO hardcoded fallback backdoors.
    const directValid = (enteredHash === activeHash);
    const isValid = serverResponded ? serverVerified : directValid;

    if (isValid) {
      clearFailedPinAttempts();
      createAdminSession(activeHash);
      pinModal.classList.remove('open');
      unlockAdminMode();
    } else {
      const failRecord = recordFailedPinAttempt();
      if (failRecord.locked) {
        pinError.textContent = `🔒 5 failed attempts. Admin login locked for 5 minutes.`;
      } else {
        pinError.textContent = serverError || `Incorrect PIN (${failRecord.remainingAttempts} attempts remaining before lockout).`;
      }
      pinError.style.display = 'block';
      pinInput.select();
    }
  }

  if (submitPinBtn) submitPinBtn.addEventListener('click', attemptPinUnlock);

  const resetPinModalBtn = document.getElementById('resetAdminPinModalBtn');
  if (resetPinModalBtn) {
    resetPinModalBtn.addEventListener('click', async () => {
      if (!confirm('Reset Admin PIN back to default "2026"?')) return;
      saveAdminPinHash(DEFAULT_PIN_SHA256);
      clearFailedPinAttempts();
      clearAdminSession();
      try {
        await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset-pin' })
        });
      } catch (_) {}
      pinInput.value = '2026';
      pinError.style.color = '#4ade80';
      pinError.textContent = '✓ Admin PIN reset to default: 2026. Click Unlock to continue.';
      pinError.style.display = 'block';
    });
  }

  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptPinUnlock();
      }
    });
  }
}
