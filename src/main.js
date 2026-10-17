/**
 * BASMA | بصمة (@basma.llb) — Modular Production Entrypoint
 * Orchestrates all layout, interactive studio, catalog, security, SEO, and lazy-loaded Admin CMS modules.
 */

import { initErrorBoundary } from './components/ui/ErrorBoundary.js';
import { init3DTiltAndMagneticButtons } from './components/ui/Buttons.js';
import { initModalsAndCart } from './components/ui/Modals.js';
import { initNavbar, applyTranslations } from './components/layout/Navbar.js';
import { initMobileMenu } from './components/layout/MobileMenu.js';
import { initBreadcrumbs } from './components/layout/Breadcrumbs.js';
import { initFooter, syncContactAndWhatsAppLinks } from './components/layout/Footer.js';
import { initHero } from './components/sections/Hero.js';
import { initWallVibeStudio } from './components/sections/WallVibeStudio.js';
import { initSizeCalculator, updateSizeCalculator } from './components/sections/SizeCalculator.js';
import { initCatalog, renderCatalog } from './components/sections/Catalog.js';
import { initCustomStudio, updateCustomConfiguratorEstimate } from './components/sections/CustomStudio.js';
import { initCraftProcess } from './components/sections/CraftProcess.js';
import {
  storeState,
  loadPersistentStoreState
} from './services/storeService.js';
import { injectStructuredDataSchema } from './services/seoSchemaService.js';
import { hasValidAdminSession } from './utils/security.js';

let adminModulePromise = null;

async function ensureAdminLoaded() {
  if (!adminModulePromise) {
    adminModulePromise = import('./components/admin/AdminModal.js').then(mod => {
      mod.initAdminModal();
      return mod;
    });
  }
  return adminModulePromise;
}

function bindLazyAdminTrigger() {
  const lockBtn = document.getElementById('adminFooterLockBtn');
  if (lockBtn) {
    lockBtn.addEventListener('click', async (e) => {
      if (!adminModulePromise) {
        e.preventDefault();
        const mod = await ensureAdminLoaded();
        if (hasValidAdminSession()) {
          mod.enterAdminMode();
        } else {
          mod.openAdminPinModal();
        }
      }
    });
  }

  // If an admin session is already active, preload the admin module immediately
  if (hasValidAdminSession()) {
    ensureAdminLoaded();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initErrorBoundary();

  // Initialize UI & Interactive Sections
  initNavbar();
  initMobileMenu();
  initBreadcrumbs();
  initHero();
  initWallVibeStudio();
  initSizeCalculator();
  initCatalog();
  initCustomStudio();
  initCraftProcess();
  initModalsAndCart();
  initFooter();
  init3DTiltAndMagneticButtons();

  // Sync store state from localStorage / Cloud / store-state.json
  await loadPersistentStoreState();
  syncContactAndWhatsAppLinks();
  renderCatalog();
  updateSizeCalculator();
  updateCustomConfiguratorEstimate();
  applyTranslations();
  injectStructuredDataSchema(storeState.products, storeState.settings);

  // Lazy-load Admin CMS when requested or if session is active
  bindLazyAdminTrigger();
});
