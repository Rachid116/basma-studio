/**
 * BASMA (@basma.llb) — Filterable Product Catalog Section Component
 * Includes Breadcrumb updates, Dynamic SEO titles, 3D Tilt Cards, and Admin Quick-Edit hooks.
 */

import { storeState } from '../../services/storeService.js';
import { formatPrice, animatePriceElement } from '../../utils/priceFormatter.js';
import { escapeHtml } from '../../utils/sanitize.js';
import { I18N } from '../../data/i18n.js';
import { addProductToCart, openQuickViewModal } from '../ui/Modals.js';
import { init3DTiltAndMagneticButtons } from '../ui/Buttons.js';
import { updateBreadcrumbTrail } from '../layout/Breadcrumbs.js';
import { updatePageSeoMeta } from '../../services/seoSchemaService.js';

let currentCatalogFilter = 'all';
let adminEditCallback = null;

export function setAdminProductEditHandler(fn) {
  adminEditCallback = fn;
}

export function getCurrentCatalogFilter() {
  return currentCatalogFilter;
}

const CATEGORY_META = {
  all: {
    crumb: 'All Masterpieces',
    title: 'BASMA | بصمة — Precision 3D CNC Wood Carvings & Modern Wall Art Silhouettes (@basma.llb)',
    desc: 'Explore all Basma (@basma.llb) precision 3D CNC solid wood reliefs and sleek matte-black automotive & gaming wall silhouettes.'
  },
  garage: {
    crumb: 'The Garage (Automotive Silhouettes)',
    title: 'The Garage — Automotive Wall Silhouettes & F1 Circuits | BASMA (@basma.llb)',
    desc: 'Precision CNC-routed matte carbon-black supercar profiles, 911 GT3 RS cutouts, 4x4 overland emblems, and 3D Grand Prix track sculptures.'
  },
  relief: {
    crumb: '3D Relief & Heritage',
    title: '3D CNC Solid Walnut Relief Carvings & Lebanese Heritage | BASMA (@basma.llb)',
    desc: 'Deep-carved solid walnut and aged cedar 3D CNC reliefs, sacred medallions, Cedar of Lebanon plaques, and gold-fluted Arabic calligraphy.'
  },
  anime: {
    crumb: 'Anime & Gaming Lounge',
    title: 'Anime & Gaming Lounge Wood Wall Art | BASMA (@basma.llb)',
    desc: 'Layered matte-black and gold-inlaid samurai katana crests, geometric wolf masks, and pro gaming sanctuary wall emblems.'
  }
};

export function renderCatalog(categoryFilter = currentCatalogFilter) {
  currentCatalogFilter = categoryFilter;
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const filtered = categoryFilter === 'all'
    ? storeState.products
    : storeState.products.filter(p => p.category === categoryFilter);

  const langDict = I18N[storeState.currentLang] || I18N.en;

  grid.innerHTML = filtered.map(prod => {
    const safeDefaultIdx = Math.min(prod.defaultSizeIndex || 0, prod.sizes.length - 1);
    const defaultSize = prod.sizes[safeDefaultIdx] || prod.sizes[0];
    const optionsHTML = prod.sizes.map((s, idx) => `
      <option value="${idx}" ${idx === safeDefaultIdx ? 'selected' : ''}>
        ${escapeHtml(s.label)} — ${formatPrice(s.priceUSD, storeState.currentCurrencyIndex)}
      </option>
    `).join('');

    const descriptiveAlt = `${prod.title} — ${prod.styleBadge} in ${prod.finish} by Basma (@basma.llb)`;

    return `
      <article class="product-card tilt-3d-surface" data-product-id="${escapeHtml(prod.id)}">
        <div class="tilt-glare-layer" aria-hidden="true"></div>
        <div class="product-media">
          <span class="product-style-badge ${escapeHtml(prod.badgeClass || 'badge-silhouette')}">${escapeHtml(prod.styleBadge)}</span>
          <button type="button" class="quick-view-btn" data-qv-id="${escapeHtml(prod.id)}" title="Quick View & High-Res Specs" aria-label="Quick view ${escapeHtml(prod.title)}">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button type="button" class="card-admin-edit-pill" data-admin-edit-id="${escapeHtml(prod.id)}" title="Edit Product in Admin CMS">
            ✏️ Edit Product
          </button>
          <img src="${escapeHtml(prod.image)}" alt="${escapeHtml(descriptiveAlt)}" loading="lazy" decoding="async" width="400" height="340" />
        </div>

        <div class="product-body">
          <div style="font-size:0.74rem; font-weight:700; color:var(--accent-walnut); text-transform:uppercase; letter-spacing:0.05em;">
            ${escapeHtml(prod.finish)}
          </div>
          <h3 class="product-title">${escapeHtml(prod.title)}</h3>
          <p class="product-desc">${escapeHtml(prod.description)}</p>

          <div class="product-config-row">
            <select class="argon-select card-size-select" data-prod-id="${escapeHtml(prod.id)}" aria-label="Select size for ${escapeHtml(prod.title)}">
              ${optionsHTML}
            </select>
            <span class="product-price-tag" id="price-${escapeHtml(prod.id)}" data-usd="${defaultSize.priceUSD}">${formatPrice(defaultSize.priceUSD, storeState.currentCurrencyIndex)}</span>
          </div>

          <button type="button" class="btn-argon btn-primary-walnut card-add-btn magnetic-btn" data-add-id="${escapeHtml(prod.id)}" style="width:100%; margin-top:0.25rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <span>${langDict.btn_add_to_cart}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  init3DTiltAndMagneticButtons();

  grid.querySelectorAll('.card-size-select').forEach(selectEl => {
    selectEl.addEventListener('change', (e) => {
      const prodId = e.target.getAttribute('data-prod-id');
      const sizeIdx = parseInt(e.target.value, 10);
      const prod = storeState.products.find(p => p.id === prodId);
      if (prod && prod.sizes[sizeIdx]) {
        const priceSpan = document.getElementById(`price-${prodId}`);
        animatePriceElement(priceSpan, prod.sizes[sizeIdx].priceUSD, storeState.currentCurrencyIndex);
      }
    });
  });

  grid.querySelectorAll('.card-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-add-id');
      const prod = storeState.products.find(p => p.id === prodId);
      const selectEl = grid.querySelector(`.card-size-select[data-prod-id="${prodId}"]`);
      const sizeIdx = selectEl ? parseInt(selectEl.value, 10) : prod.defaultSizeIndex;
      if (prod) {
        addProductToCart(prod, sizeIdx);
      }
    });
  });

  grid.querySelectorAll('.quick-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-qv-id');
      openQuickViewModal(prodId);
    });
  });

  grid.querySelectorAll('[data-admin-edit-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const prodId = btn.getAttribute('data-admin-edit-id');
      if (adminEditCallback) adminEditCallback(prodId);
    });
  });
}

export function initCatalog() {
  const tabBtns = document.querySelectorAll('.nav-pill-btn[data-category]');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-category');
      tabBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderCatalog(cat);
      const meta = CATEGORY_META[cat] || CATEGORY_META.all;
      updateBreadcrumbTrail(['Home', 'Collections', meta.crumb]);
      updatePageSeoMeta({
        title: meta.title,
        description: meta.desc,
        sectionHash: 'collections'
      });
    });
  });
  renderCatalog('all');
}
