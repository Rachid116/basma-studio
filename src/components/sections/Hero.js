/**
 * BASMA (@basma.llb) — Hero Dual-Style Showcase Section Component
 */

import { storeState } from '../../services/storeService.js';
import { addProductToCart } from '../ui/Modals.js';

export function initHero() {
  const card = document.getElementById('heroShowcaseCard');
  const modeBtns = document.querySelectorAll('[data-showcase-mode]');
  const slideSilhouette = document.getElementById('slideSilhouette');
  const slideRelief = document.getElementById('slideRelief');
  const specPills = document.getElementById('showcaseSpecPills');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-showcase-mode');
      modeBtns.forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      if (card) card.setAttribute('data-mode', mode);

      if (mode === 'silhouette') {
        slideSilhouette?.classList.add('active');
        slideRelief?.classList.remove('active');
        if (specPills) {
          specPills.innerHTML = `
            <span class="spec-mini-pill">✦ @basma.llb Drive The Vibe</span>
            <span class="spec-mini-pill">✦ Matte Carbon Wood Cutout</span>
            <span class="spec-mini-pill">✦ 15mm Floating Wall Standoffs</span>
          `;
        }
      } else {
        slideRelief?.classList.add('active');
        slideSilhouette?.classList.remove('active');
        if (specPills) {
          specPills.innerHTML = `
            <span class="spec-mini-pill">✦ @basma.llb 3D Wood Design</span>
            <span class="spec-mini-pill">✦ Deep Solid Walnut CNC Relief</span>
            <span class="spec-mini-pill">✦ Hand-Oiled Artisan Finish</span>
          `;
        }
      }
    });
  });

  document.querySelectorAll('[data-quick-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-quick-add');
      const product = storeState.products.find(p => p.id === prodId) || storeState.products[0];
      if (product) {
        addProductToCart(product, product.defaultSizeIndex);
      }
    });
  });
}
