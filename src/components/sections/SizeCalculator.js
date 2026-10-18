/**
 * BASMA (@basma.llb) — Live Size & Studio Price Calculator Section Component
 */

import { storeState } from '../../services/storeService.js';
import { formatPrice, animatePriceElement } from '../../utils/priceFormatter.js';
import { renderCartDrawer, openCartDrawer } from '../ui/Modals.js';
import { showToast } from '../ui/ToastNotifications.js';
import { updateCustomConfiguratorEstimate } from './CustomStudio.js';

let currentCalcType = 'silhouette';

export function updateSizeCalculator() {
  const slider = document.getElementById('sizeRangeSlider');
  if (!slider) return;
  const widthCm = parseInt(slider.value, 10);
  const heightCm = currentCalcType === 'silhouette' ? Math.round(widthCm * 0.55) : Math.round(widthCm * 0.78);
  const depthCm = currentCalcType === 'silhouette' ? '1.5' : '3.2';

  const pixelWidth = Math.round((widthCm / 210) * 440);
  const scaledArtBox = document.getElementById('scaledArtBox');
  if (scaledArtBox) {
    const clampedPx = Math.max(95, Math.min(340, pixelWidth));
    scaledArtBox.style.width = `min(84%, ${clampedPx}px)`;
  }

  const visualizerWidthBadge = document.getElementById('visualizerWidthBadge');
  if (visualizerWidthBadge) {
    visualizerWidthBadge.textContent = `${widthCm} cm × ${heightCm} cm`;
  }

  const calcSelectedWidthText = document.getElementById('calcSelectedWidthText');
  if (calcSelectedWidthText) {
    calcSelectedWidthText.textContent = `${widthCm} cm`;
  }

  const cutoutBase = Number(storeState.settings.calcCutoutBase) || 28;
  const cutoutRate = Number(storeState.settings.calcCutoutPerCm) || 0.95;
  const reliefBase = Number(storeState.settings.calcReliefBase) || 45;
  const reliefRate = Number(storeState.settings.calcReliefPerCm) || 1.45;

  const baseUSD = currentCalcType === 'silhouette'
    ? Math.round(cutoutBase + widthCm * cutoutRate)
    : Math.round(reliefBase + widthCm * reliefRate);

  const calcPriceOutput = document.getElementById('calcPriceOutput');
  if (calcPriceOutput) {
    animatePriceElement(calcPriceOutput, baseUSD, storeState.currentCurrencyIndex);
  }

  const calcAspectOutput = document.getElementById('calcAspectOutput');
  if (calcAspectOutput) {
    calcAspectOutput.textContent = `${widthCm} × ${heightCm} × ${depthCm} cm`;
  }

  const titleEl = document.getElementById('calcPlacementTitle');
  const descEl = document.getElementById('calcPlacementDesc');
  if (titleEl && descEl) {
    if (widthCm <= 45) {
      titleEl.textContent = 'Desk, Bookshelf & Office Accent';
      descEl.textContent = 'Compact proportion ideal for executive desks, gaming shelves, or entryway consoles.';
    } else if (widthCm <= 75) {
      titleEl.textContent = 'Bedroom Wall, Study or Gaming Setup';
      descEl.textContent = 'Balanced mid-size focal piece above monitors, headboards, or reading nooks.';
    } else {
      titleEl.textContent = 'Living Room & Majlis Statement Masterpiece';
      descEl.textContent = 'Commanding architectural scale engineered for wide sofas, dining rooms, and showrooms.';
    }
  }
}

export function initSizeCalculator() {
  const slider = document.getElementById('sizeRangeSlider');
  const typeBtns = document.querySelectorAll('[data-calc-type]');
  const orderCalculatedSizeBtn = document.getElementById('orderCalculatedSizeBtn');
  const pushToConfiguratorBtn = document.getElementById('pushToConfiguratorBtn');

  if (slider) {
    slider.addEventListener('input', updateSizeCalculator);
  }

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentCalcType = btn.getAttribute('data-calc-type');
      typeBtns.forEach(b => b.classList.toggle('active', b === btn));
      updateSizeCalculator();
    });
  });

  if (orderCalculatedSizeBtn) {
    orderCalculatedSizeBtn.addEventListener('click', () => {
      const widthCm = parseInt(slider.value, 10);
      const heightCm = currentCalcType === 'silhouette' ? Math.round(widthCm * 0.55) : Math.round(widthCm * 0.78);
      const usd = parseInt(document.getElementById('calcPriceOutput').getAttribute('data-usd') || '104', 10);
      const imgPath = currentCalcType === 'silhouette' ? 'assets/product-supercar-wall.jpg' : 'assets/product-heritage-relief.jpg';
      const pieceTitle = currentCalcType === 'silhouette'
        ? `Bespoke Scaled Silhouette (${widthCm}cm)`
        : `Bespoke Scaled 3D CNC Relief (${widthCm}cm)`;

      storeState.cart.push({
        cartItemId: 'calc-' + Date.now(),
        productId: 'custom-sized-piece',
        title: pieceTitle,
        style: currentCalcType === 'silhouette' ? 'Matte Wood Cutout' : '3D CNC Relief',
        sizeLabel: `${widthCm} × ${heightCm} cm`,
        finish: currentCalcType === 'silhouette' ? 'Matte Carbon Black' : 'Rich Natural Walnut',
        priceUSD: usd,
        qty: 1,
        image: imgPath,
        isCustom: true
      });
      renderCartDrawer();
      openCartDrawer();
      showToast(`Added ${widthCm}cm piece to your order bag!`, {
        image: imgPath,
        title: pieceTitle,
        subMeta: `${widthCm} × ${heightCm} cm • ${formatPrice(usd, storeState.currentCurrencyIndex)}`
      });
    });
  }

  if (pushToConfiguratorBtn) {
    pushToConfiguratorBtn.addEventListener('click', () => {
      const widthCm = parseInt(slider.value, 10);
      const heightCm = currentCalcType === 'silhouette' ? Math.round(widthCm * 0.55) : Math.round(widthCm * 0.78);
      const wInput = document.getElementById('customWidthInput');
      const hInput = document.getElementById('customHeightInput');
      if (wInput && hInput) {
        wInput.value = widthCm;
        hInput.value = heightCm;
        updateCustomConfiguratorEstimate();
      }
      document.getElementById('custom-configurator')?.scrollIntoView({ behavior: 'smooth' });
      showToast(`Pushed ${widthCm} × ${heightCm} cm dimensions to Custom Studio!`);
    });
  }

  updateSizeCalculator();
}
