/**
 * BASMA (@basma.llb) — Animated Slide-Over Mobile Drawer Menu Component
 * Provides links to all studio sections, Currency/Language toggles, Cart trigger, and WhatsApp Concierge.
 */

import { openCartDrawer } from '../ui/Modals.js';

export function closeMobileMenuDrawer() {
  const drawer = document.getElementById('mobileNavDrawer');
  const btn = document.getElementById('mobileMenuBtn');
  if (drawer) drawer.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const closeMobileNavBtn = document.getElementById('closeMobileNavBtn');
  const mobileCartBtn = document.getElementById('mobileOpenCartBtn');
  const mobileCurrencyBtn = document.getElementById('mobileCurrencyBtn');
  const mobileLangBtn = document.getElementById('mobileLangBtn');

  if (mobileMenuBtn && mobileNavDrawer) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileNavDrawer.classList.toggle('open');
      mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  if (closeMobileNavBtn) {
    closeMobileNavBtn.addEventListener('click', closeMobileMenuDrawer);
  }

  if (mobileNavDrawer) {
    mobileNavDrawer.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenuDrawer();
      });
    });
  }

  if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', () => {
      closeMobileMenuDrawer();
      openCartDrawer();
    });
  }

  if (mobileCurrencyBtn) {
    mobileCurrencyBtn.addEventListener('click', () => {
      document.getElementById('currencyToggleBtn')?.click();
    });
  }

  if (mobileLangBtn) {
    mobileLangBtn.addEventListener('click', () => {
      document.getElementById('langToggleBtn')?.click();
    });
  }
}
