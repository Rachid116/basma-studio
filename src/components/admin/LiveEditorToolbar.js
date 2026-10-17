/**
 * BASMA (@basma.llb) — Live In-Site Inline ContentEditable Visual Editor Toolbar
 * Allows editing headlines, subheadlines, and section copy directly on the page when Admin Mode is unlocked.
 */

import { storeState, savePersistentStoreState } from '../../services/storeService.js';
import { sanitizeRichInlineHtml } from '../../utils/sanitize.js';
import { showToast } from '../ui/ToastNotifications.js';

let isInlineEditActive = true;

export function setInlineEditables(enabled, isAdminUnlocked) {
  const selector = 'h1[data-i18n], h2[data-i18n], h3[data-i18n], p[data-i18n], .craft-card p, .footer-col p';
  document.querySelectorAll(selector).forEach((el, idx) => {
    if (!el.getAttribute('data-i18n') && !el.getAttribute('data-cms-id')) {
      el.setAttribute('data-cms-id', `cms-node-${idx}`);
    }
    if (enabled && isAdminUnlocked) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      if (!el.dataset.cmsListenerBound) {
        el.dataset.cmsListenerBound = 'true';
        el.addEventListener('blur', () => {
          if (!document.body.classList.contains('admin-mode-active')) return;
          const cleanHtml = sanitizeRichInlineHtml(el.innerHTML);
          el.innerHTML = cleanHtml;
          const i18nKey = el.getAttribute('data-i18n');
          const cmsId = el.getAttribute('data-cms-id');
          if (i18nKey) {
            storeState.inlineEdits[`${storeState.currentLang}:${i18nKey}`] = cleanHtml;
          } else if (cmsId) {
            storeState.inlineEdits[cmsId] = cleanHtml;
          }
          savePersistentStoreState();
        });
      }
    } else {
      el.removeAttribute('contenteditable');
    }
  });
  document.body.classList.toggle('admin-inline-editing', enabled && isAdminUnlocked);
}

export function initLiveEditorToolbar({ onOpenDrawer, onExitAdmin }) {
  const toggleInlineBtn = document.getElementById('toggleInlineEditBtn');
  const inlineStatusText = document.getElementById('inlineEditStatusText');
  if (toggleInlineBtn && !toggleInlineBtn.dataset.bound) {
    toggleInlineBtn.dataset.bound = 'true';
    toggleInlineBtn.addEventListener('click', () => {
      isInlineEditActive = !isInlineEditActive;
      toggleInlineBtn.classList.toggle('active', isInlineEditActive);
      if (inlineStatusText) inlineStatusText.textContent = isInlineEditActive ? 'ON' : 'OFF';
      setInlineEditables(isInlineEditActive, true);
    });
  }

  const openDrawerBtn = document.getElementById('openAdminDrawerBtn');
  if (openDrawerBtn && !openDrawerBtn.dataset.bound) {
    openDrawerBtn.dataset.bound = 'true';
    openDrawerBtn.addEventListener('click', () => {
      if (onOpenDrawer) onOpenDrawer();
    });
  }

  const saveAllBtn = document.getElementById('saveAdminAllBtn');
  if (saveAllBtn && !saveAllBtn.dataset.bound) {
    saveAllBtn.dataset.bound = 'true';
    saveAllBtn.addEventListener('click', async () => {
      await savePersistentStoreState();
      showToast('All visual & store changes saved & synced live!', {
        subMeta: 'Persisted to LocalStorage & Serverless Store API'
      });
    });
  }

  const exitAdminBtn = document.getElementById('exitAdminModeBtn');
  if (exitAdminBtn && !exitAdminBtn.dataset.bound) {
    exitAdminBtn.dataset.bound = 'true';
    exitAdminBtn.addEventListener('click', () => {
      if (onExitAdmin) onExitAdmin();
    });
  }
}

export function getInlineEditActiveState() {
  return isInlineEditActive;
}
