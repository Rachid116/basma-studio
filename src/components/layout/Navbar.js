/**
 * BASMA (@basma.llb) — Sticky Glassmorphic Navbar, Smooth Scroll Logo, Currency & Language Controls
 */

import { storeState, notifyStoreListeners } from '../../services/storeService.js';
import { CURRENCIES } from '../../utils/priceFormatter.js';
import { I18N } from '../../data/i18n.js';
import { sanitizeRichInlineHtml } from '../../utils/sanitize.js';
import { showToast } from '../ui/ToastNotifications.js';
import { updatePageSeoMeta } from '../../services/seoSchemaService.js';

export function applyTranslations() {
  const lang = storeState.currentLang;
  const dict = I18N[lang] || I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const customKey = `${lang}:${key}`;
    if (storeState.inlineEdits && storeState.inlineEdits[customKey]) {
      el.innerHTML = sanitizeRichInlineHtml(storeState.inlineEdits[customKey]);
    } else if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Preserve Admin CMS Homepage & Craft & Footer edits over static English defaults
  if (lang === 'en' && storeState.settings?.cmsContent) {
    const cms = storeState.settings.cmsContent;
    if (cms.hero) {
      const heroTitle = document.querySelector('.hero-title');
      const heroSubtitle = document.querySelector('.hero-subtitle');
      const heroBadge = document.querySelector('.hero-section .argon-badge span:last-child');
      if (heroTitle && cms.hero.headline) heroTitle.innerHTML = cms.hero.headline;
      if (heroSubtitle && cms.hero.subheadline) heroSubtitle.textContent = cms.hero.subheadline;
      if (heroBadge && cms.hero.goldBadge) heroBadge.textContent = cms.hero.goldBadge;
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

  // Always apply any [data-cms-id] inline edits
  if (storeState.inlineEdits) {
    document.querySelectorAll('[data-cms-id]').forEach(el => {
      const id = el.getAttribute('data-cms-id');
      if (storeState.inlineEdits[id]) {
        el.innerHTML = sanitizeRichInlineHtml(storeState.inlineEdits[id]);
      }
    });
  }
}

export function applyInlineEditsToDOM() {
  applyTranslations();
}

export function initNavbar(onStateRefresh) {
  const navbar = document.getElementById('mainNavbar');
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // Clickable Top-Left Basma Logo smooth-scrolls to top & resets title
  const brandLogo = document.querySelector('.brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', window.location.pathname);
      updatePageSeoMeta({
        title: 'BASMA | بصمة — Precision 3D CNC Wood Carvings & Modern Wall Art Silhouettes (@basma.llb)',
        description: 'Basma (بصمة | @basma.llb) — Luxury Lebanese studio crafting Precision 3D CNC Wood Relief Carvings and Sleek Matte-Black Layered Automotive Wall Silhouettes.',
        sectionHash: ''
      });
    });
  }

  // Dynamic section title & meta updates on nav link click
  const sectionSeoMap = {
    '#collections': {
      title: 'Shop Curated 3D Wood & Automotive Collections | BASMA (@basma.llb)',
      description: 'Browse Basma’s precision CNC-routed automotive silhouettes, solid walnut 3D heritage reliefs, and anime & gaming wall art.'
    },
    '#wall-vibe-studio': {
      title: 'Wall Vibe & Night Spotlight Room Simulator | BASMA (@basma.llb)',
      description: 'Preview Basma 3D wood carvings and matte-black car silhouettes on sunlit plaster, slate, wood slats, and brick under daylight or warm night spotlight.'
    },
    '#custom-configurator': {
      title: '“Carve Your Own” Custom 3D CNC Order Studio | BASMA (@basma.llb)',
      description: 'Upload any car, portrait, or emblem photo to simulate a 3D CNC solid wood relief or matte-black silhouette with custom laser engraving.'
    },
    '#size-price-guide': {
      title: 'Live Size & Studio Price Calculator (30cm–120cm) | BASMA (@basma.llb)',
      description: 'Visualize real-world wall scale from 30cm to 120cm above a 210cm living room sofa and calculate instant studio pricing.'
    },
    '#the-craft': {
      title: 'The Craft — From Raw Walnut to 0.1mm 3D CNC Relief | BASMA (@basma.llb)',
      description: 'Explore how Basma combines 3D Z-depth digital modeling, multi-axis CNC routing, and hand-rubbed natural beeswax oil finishes.'
    }
  };

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const hash = link.getAttribute('href');
      if (sectionSeoMap[hash]) {
        updatePageSeoMeta({
          title: sectionSeoMap[hash].title,
          description: sectionSeoMap[hash].description,
          sectionHash: hash
        });
      }
      document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === hash);
      });
    });
  });

  // Currency Switcher
  const currencyToggleBtn = document.getElementById('currencyToggleBtn');
  const currencyLabel = document.getElementById('currencyLabel');
  const mobileCurrencyLabel = document.getElementById('mobileCurrencyLabel');
  if (currencyToggleBtn) {
    currencyToggleBtn.addEventListener('click', () => {
      storeState.currentCurrencyIndex = (storeState.currentCurrencyIndex + 1) % CURRENCIES.length;
      const curr = CURRENCIES[storeState.currentCurrencyIndex];
      if (currencyLabel) currencyLabel.textContent = curr.label;
      if (mobileCurrencyLabel) mobileCurrencyLabel.textContent = curr.label;
      if (onStateRefresh) onStateRefresh();
      notifyStoreListeners();
      showToast(`Currency switched to ${curr.label}`);
    });
  }

  // Language Switcher (EN / AR with RTL support)
  const langToggleBtn = document.getElementById('langToggleBtn');
  const langLabel = document.getElementById('langLabel');
  const mobileLangLabel = document.getElementById('mobileLangLabel');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      storeState.currentLang = storeState.currentLang === 'en' ? 'ar' : 'en';
      const lang = storeState.currentLang;
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.body.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      const labelText = lang === 'en' ? 'EN / عربي' : 'عربي / EN';
      if (langLabel) langLabel.textContent = labelText;
      if (mobileLangLabel) mobileLangLabel.textContent = labelText;
      applyTranslations();
      if (onStateRefresh) onStateRefresh();
      showToast(lang === 'ar' ? 'تم التبديل إلى اللغة العربية' : 'Switched language to English');
    });
  }
}
