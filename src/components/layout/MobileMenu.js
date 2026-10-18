/**
 * BASMA (@basma.llb) — Animated Slide-Over Mobile Drawer Menu Component
 * Provides links to all studio sections, Currency/Language toggles, Cart trigger, and WhatsApp Concierge.
 */

import { openCartDrawer } from '../ui/Modals.js';

export function openMobileMenuDrawer() {
  const drawer = document.getElementById('mobileNavDrawer');
  const backdrop = document.getElementById('mobileNavBackdrop');
  const btn = document.getElementById('mobileMenuBtn');
  if (drawer) {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  if (backdrop) {
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
  }
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('mobile-drawer-open');
}

export function closeMobileMenuDrawer() {
  const drawer = document.getElementById('mobileNavDrawer');
  const backdrop = document.getElementById('mobileNavBackdrop');
  const btn = document.getElementById('mobileMenuBtn');
  if (drawer) {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  if (backdrop) {
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('mobile-drawer-open');
}

if (typeof window !== 'undefined') {
  window.openMobileMenuDrawer = openMobileMenuDrawer;
  window.closeMobileMenuDrawer = closeMobileMenuDrawer;
}

export function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
  const mobileCartBtn = document.getElementById('mobileOpenCartBtn');
  const mobileCurrencyBtn = document.getElementById('mobileCurrencyBtn');
  const mobileLangBtn = document.getElementById('mobileLangBtn');

  // 1. Toggle mobile menu drawer via hamburger button
  if (mobileMenuBtn && mobileNavDrawer) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = mobileNavDrawer.classList.contains('open');
      if (isOpen) {
        closeMobileMenuDrawer();
      } else {
        openMobileMenuDrawer();
      }
    });
  }

  // 2. Close 'X' button inside mobile drawer (handles both IDs and class selector)
  const closeBtns = [
    document.getElementById('closeMobileMenuBtn'),
    document.getElementById('closeMobileNavBtn'),
    mobileNavDrawer?.querySelector('.mobile-drawer-close')
  ].filter(Boolean);

  closeBtns.forEach(btn => {
    const handleClose = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMobileMenuDrawer();
    };
    btn.addEventListener('click', handleClose);
    btn.addEventListener('touchend', handleClose, { passive: false });
  });

  // 3. Dark backdrop tap & click dismissal
  if (mobileNavBackdrop) {
    const handleBackdrop = (e) => {
      e.preventDefault();
      closeMobileMenuDrawer();
    };
    mobileNavBackdrop.addEventListener('click', handleBackdrop);
    mobileNavBackdrop.addEventListener('touchend', handleBackdrop, { passive: false });
  }

  // 4. Outside document tap dismissal
  document.addEventListener('click', (e) => {
    if (!mobileNavDrawer || !mobileNavDrawer.classList.contains('open')) return;
    if (mobileNavDrawer.contains(e.target) || mobileMenuBtn?.contains(e.target)) return;
    closeMobileMenuDrawer();
  });

  // 5. Auto-close when tapping any navigation or contact link inside drawer
  if (mobileNavDrawer) {
    mobileNavDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenuDrawer();
      });
    });
  }

  // 6. Mobile order bag trigger: closes mobile drawer and opens cart
  if (mobileCartBtn) {
    mobileCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileMenuDrawer();
      openCartDrawer();
    });
  }

  // 7. Currency & Language toggle bridges
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

  // 8. Keyboard accessibility: Escape key closes menu
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      if (mobileNavDrawer?.classList.contains('open')) {
        closeMobileMenuDrawer();
      }
    }
  });
}
