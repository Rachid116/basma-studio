/**
 * BASMA (@basma.llb) — Quick-View Modal & Slide-Over Shopping Cart Drawer
 */

import { storeState } from '../../services/storeService.js';
import { formatPrice, animatePriceElement } from '../../utils/priceFormatter.js';
import { buildOrderTicketMessage, buildWhatsAppUrl } from '../../utils/whatsappBuilder.js';
import { escapeHtml, sanitizePlainText } from '../../utils/sanitize.js';
import { showToast } from './ToastNotifications.js';
import { updateBreadcrumbTrail } from '../layout/Breadcrumbs.js';

let activeQuickViewProduct = null;

export function addProductToCart(product, sizeIndex) {
  const selectedSize = product.sizes[sizeIndex] || product.sizes[0];
  const existing = storeState.cart.find(
    item => !item.isCustom && item.productId === product.id && item.sizeLabel === selectedSize.label
  );

  if (existing) {
    existing.qty += 1;
  } else {
    storeState.cart.push({
      cartItemId: 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      productId: product.id,
      title: product.title,
      style: product.styleBadge,
      sizeLabel: selectedSize.label,
      finish: product.finish,
      priceUSD: selectedSize.priceUSD,
      qty: 1,
      image: product.image,
      isCustom: false
    });
  }

  renderCartDrawer();
  showToast(`Added "${product.title}"`, {
    image: product.image,
    title: product.title,
    subMeta: `${selectedSize.label} • ${formatPrice(selectedSize.priceUSD, storeState.currentCurrencyIndex)}`
  });
}

export function openQuickViewModal(prodId) {
  const prod = storeState.products.find(p => p.id === prodId);
  if (!prod) return;
  activeQuickViewProduct = prod;

  document.getElementById('qvBadge').textContent = prod.styleBadge;
  const qvImg = document.getElementById('qvImage');
  qvImg.src = prod.image;
  qvImg.alt = `${prod.title} — ${prod.finish} by Basma (@basma.llb)`;
  document.getElementById('qvTitle').textContent = prod.title;
  document.getElementById('qvDesc').textContent = prod.description;

  const qvBreadcrumb = document.getElementById('qvBreadcrumbCurrent');
  if (qvBreadcrumb) qvBreadcrumb.textContent = prod.title;

  updateBreadcrumbTrail(['Home', 'Collections', prod.title]);

  document.getElementById('qvSpecs').innerHTML = `
    <div><strong>Material &amp; Finish:</strong> ${escapeHtml(prod.finish)}</div>
    <div><strong>Precision Routing:</strong> Multi-axis 0.1mm CNC tolerance</div>
    <div><strong>Mounting Hardware:</strong> Hidden floating standoffs &amp; 3M architectural pads included</div>
    <div><strong>Studio Origin:</strong> Handcrafted by Basma (@basma.llb)</div>
  `;

  const qvSizeSelect = document.getElementById('qvSizeSelect');
  qvSizeSelect.innerHTML = prod.sizes.map((s, idx) => `
    <option value="${idx}" ${idx === prod.defaultSizeIndex ? 'selected' : ''}>
      ${escapeHtml(s.label)}
    </option>
  `).join('');

  const qvPrice = document.getElementById('qvPrice');
  const defPrice = (prod.sizes[prod.defaultSizeIndex] || prod.sizes[0]).priceUSD;
  qvPrice.textContent = formatPrice(defPrice, storeState.currentCurrencyIndex);
  qvPrice.setAttribute('data-usd', defPrice);

  qvSizeSelect.onchange = () => {
    const idx = parseInt(qvSizeSelect.value, 10);
    animatePriceElement(qvPrice, prod.sizes[idx].priceUSD, storeState.currentCurrencyIndex);
  };

  document.getElementById('globalBackdrop').classList.add('open');
  document.getElementById('quickViewModal').classList.add('open');
}

export function closeQuickViewModal() {
  const modal = document.getElementById('quickViewModal');
  if (modal) modal.classList.remove('open');
  const cartOpen = document.getElementById('cartDrawer')?.classList.contains('open');
  const adminOpen = document.getElementById('adminCmsDrawer')?.classList.contains('open');
  if (!cartOpen && !adminOpen) {
    document.getElementById('globalBackdrop')?.classList.remove('open');
  }
}

export function openCartDrawer() {
  document.getElementById('globalBackdrop')?.classList.add('open');
  document.getElementById('cartDrawer')?.classList.add('open');
}

export function closeCartDrawer() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  const qvOpen = document.getElementById('quickViewModal')?.classList.contains('open');
  const adminOpen = document.getElementById('adminCmsDrawer')?.classList.contains('open');
  if (!qvOpen && !adminOpen) {
    document.getElementById('globalBackdrop')?.classList.remove('open');
  }
}

export function renderCartDrawer() {
  const container = document.getElementById('cartItemsContainer');
  const countBadge = document.getElementById('cartCountBadge');
  const mobileCartCount = document.getElementById('mobileCartCountBadge');
  const subtotalEl = document.getElementById('cartSubtotalValue');

  const totalItems = storeState.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalUSD = storeState.cart.reduce((sum, item) => sum + item.priceUSD * item.qty, 0);

  if (countBadge) countBadge.textContent = totalItems;
  if (mobileCartCount) mobileCartCount.textContent = totalItems;
  if (subtotalEl) animatePriceElement(subtotalEl, totalUSD, storeState.currentCurrencyIndex);

  if (!container) return;

  if (storeState.cart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2.25rem 1rem; background:#FFF; border-radius:var(--radius-md); border:1px dashed var(--border-subtle);">
        <p style="font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">Your Basma order bag is empty</p>
        <p style="font-size:0.82rem; color:var(--text-muted);">Explore our automotive silhouettes, 3D walnut reliefs, or build a custom piece.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = storeState.cart.map(item => `
    <div class="cart-item-card">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="cart-item-thumb" loading="lazy" />
      <div class="cart-item-info">
        <div class="cart-item-title">${escapeHtml(item.title)}</div>
        <div class="cart-item-meta">${escapeHtml(item.sizeLabel)}</div>
        <div class="cart-item-meta" style="color:var(--accent-walnut);">${escapeHtml(item.finish)}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem;">
          <div class="qty-controls">
            <button type="button" class="qty-btn" data-qty-action="dec" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Decrease quantity">−</button>
            <span style="font-size:0.82rem; font-weight:700; min-width:18px; text-align:center;">${item.qty}</span>
            <button type="button" class="qty-btn" data-qty-action="inc" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Increase quantity">+</button>
          </div>
          <strong style="font-size:0.95rem; color:var(--text-primary);">${formatPrice(item.priceUSD * item.qty, storeState.currentCurrencyIndex)}</strong>
        </div>
      </div>
      <button type="button" data-remove-id="${escapeHtml(item.cartItemId)}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0.25rem;" title="Remove item" aria-label="Remove item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');

  container.querySelectorAll('[data-qty-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-id');
      const action = btn.getAttribute('data-qty-action');
      const target = storeState.cart.find(i => i.cartItemId === id);
      if (!target) return;
      if (action === 'inc') target.qty += 1;
      if (action === 'dec') {
        target.qty -= 1;
        if (target.qty <= 0) {
          storeState.cart = storeState.cart.filter(i => i.cartItemId !== id);
        }
      }
      renderCartDrawer();
    });
  });

  container.querySelectorAll('[data-remove-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remove-id');
      storeState.cart = storeState.cart.filter(i => i.cartItemId !== id);
      renderCartDrawer();
      showToast('Item removed from your order bag.');
    });
  });
}

export function initModalsAndCart() {
  document.getElementById('openCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('closeCartBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('closeQuickViewBtn')?.addEventListener('click', closeQuickViewModal);

  document.getElementById('globalBackdrop')?.addEventListener('click', () => {
    closeCartDrawer();
    closeQuickViewModal();
    document.getElementById('adminCmsDrawer')?.classList.remove('open');
  });

  document.getElementById('qvAddToCartBtn')?.addEventListener('click', () => {
    if (!activeQuickViewProduct) return;
    const sizeIdx = parseInt(document.getElementById('qvSizeSelect').value, 10);
    addProductToCart(activeQuickViewProduct, sizeIdx);
    closeQuickViewModal();
    openCartDrawer();
  });

  const checkoutBtn = document.getElementById('checkoutWhatsAppBtn');
  const formErrorMsg = document.getElementById('checkoutFormStatusMsg');

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (storeState.cart.length === 0) {
        showToast('Your cart is empty! Add a masterpiece first.', { isError: true });
        return;
      }
      const nameInput = document.getElementById('custName');
      const phoneInput = document.getElementById('custPhone');
      const addressInput = document.getElementById('custAddress');
      const notesInput = document.getElementById('custNotes');

      const nameVal = sanitizePlainText(nameInput.value, 80);
      const phoneVal = sanitizePlainText(phoneInput.value, 40);
      const addressVal = sanitizePlainText(addressInput.value, 140);

      if (!nameVal || !phoneVal || !addressVal) {
        if (formErrorMsg) {
          formErrorMsg.textContent = '⚠️ Please fill in your Full Name, Phone/WhatsApp, and Delivery Address.';
          formErrorMsg.className = 'form-status-msg error';
          formErrorMsg.style.display = 'block';
        }
        showToast('Please enter your Name, Phone, and Delivery Address.', { isError: true });
        if (!nameVal) nameInput.focus();
        else if (!phoneVal) phoneInput.focus();
        else addressInput.focus();
        return;
      }

      if (formErrorMsg) {
        formErrorMsg.textContent = '✓ Order ticket verified! Opening WhatsApp Concierge...';
        formErrorMsg.className = 'form-status-msg success';
        formErrorMsg.style.display = 'block';
      }

      const totalUSD = storeState.cart.reduce((sum, item) => sum + item.priceUSD * item.qty, 0);
      const ticket = buildOrderTicketMessage({
        cart: storeState.cart,
        customer: { name: nameVal, phone: phoneVal, address: addressVal, notes: notesInput?.value || '' },
        formatPriceFn: (amt) => formatPrice(amt, storeState.currentCurrencyIndex),
        totalUSD
      });

      const waUrl = buildWhatsAppUrl(storeState.settings.whatsappNumber, ticket);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });
  }

  document.getElementById('copyOrderTicketBtn')?.addEventListener('click', () => {
    if (storeState.cart.length === 0) {
      showToast('Your cart is empty!', { isError: true });
      return;
    }
    const totalUSD = storeState.cart.reduce((sum, item) => sum + item.priceUSD * item.qty, 0);
    const ticket = buildOrderTicketMessage({
      cart: storeState.cart,
      customer: {
        name: document.getElementById('custName')?.value || '',
        phone: document.getElementById('custPhone')?.value || '',
        address: document.getElementById('custAddress')?.value || '',
        notes: document.getElementById('custNotes')?.value || ''
      },
      formatPriceFn: (amt) => formatPrice(amt, storeState.currentCurrencyIndex),
      totalUSD
    });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ticket).then(() => {
        showToast('Formatted order ticket copied to clipboard!');
      });
    }
  });

  renderCartDrawer();
}
