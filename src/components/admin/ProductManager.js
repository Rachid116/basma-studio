/**
 * BASMA (@basma.llb) — Full Product, Price & Global Store Manager Drawer
 */

import {
  storeState,
  getStoreSnapshot,
  applyStoreSnapshot,
  savePersistentStoreState,
  resetStoreToFactoryDefaults
} from '../../services/storeService.js';
import { escapeHtml, sanitizePlainText, sanitizePhoneDigits, validateImageUpload } from '../../utils/sanitize.js';
import { sha256Hex, DEFAULT_PIN_SHA256 } from '../../utils/security.js';
import { renderCatalog, getCurrentCatalogFilter } from '../sections/Catalog.js';
import { updateSizeCalculator } from '../sections/SizeCalculator.js';
import { injectStructuredDataSchema } from '../../services/seoSchemaService.js';
import { showToast } from '../ui/ToastNotifications.js';

let pendingUploadedAdminPhoto = '';

export function openAdminDrawer() {
  renderAdminProductList();
  populateAdminSettingsForm();
  document.getElementById('globalBackdrop')?.classList.add('open');
  document.getElementById('adminCmsDrawer')?.classList.add('open');
}

export function closeAdminDrawer() {
  document.getElementById('adminCmsDrawer')?.classList.remove('open');
  const cartOpen = document.getElementById('cartDrawer')?.classList.contains('open');
  const qvOpen = document.getElementById('quickViewModal')?.classList.contains('open');
  if (!cartOpen && !qvOpen) {
    document.getElementById('globalBackdrop')?.classList.remove('open');
  }
}

export function switchAdminTab(tabKey) {
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-admin-tab') === tabKey);
  });
  document.querySelectorAll('.admin-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `adminPane-${tabKey}`);
  });
}

export function openAdminDrawerAndLoadProduct(prodId) {
  openAdminDrawer();
  loadProductIntoAdminForm(prodId);
  switchAdminTab('add-product');
}

export function renderAdminProductList() {
  const listEl = document.getElementById('adminProductList');
  const countEl = document.getElementById('adminProdCount');
  if (countEl) countEl.textContent = storeState.products.length;
  if (!listEl) return;

  const catLabels = {
    garage: 'The Garage',
    relief: '3D Relief & Heritage',
    anime: 'Anime & Gaming'
  };

  listEl.innerHTML = storeState.products.map(prod => {
    const sPrice = prod.sizes[0]?.priceUSD || 0;
    const mPrice = prod.sizes[1]?.priceUSD || sPrice;
    const lPrice = prod.sizes[2]?.priceUSD || mPrice;
    return `
      <div class="admin-prod-item">
        <img src="${escapeHtml(prod.image)}" alt="${escapeHtml(prod.title)}" loading="lazy" />
        <div class="admin-prod-item-meta">
          <div class="admin-prod-item-title">${escapeHtml(prod.title)}</div>
          <div class="admin-prod-item-sub">${escapeHtml(catLabels[prod.category] || prod.category)} • S: $${sPrice} / M: $${mPrice} / L: $${lPrice}</div>
        </div>
        <div class="admin-prod-actions">
          <button type="button" class="admin-mini-btn" data-cms-edit="${escapeHtml(prod.id)}">Edit</button>
          <button type="button" class="admin-mini-btn delete" data-cms-delete="${escapeHtml(prod.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('[data-cms-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cms-edit');
      loadProductIntoAdminForm(id);
      switchAdminTab('add-product');
    });
  });

  listEl.querySelectorAll('[data-cms-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cms-delete');
      const target = storeState.products.find(p => p.id === id);
      if (!target) return;
      if (storeState.products.length <= 1) {
        showToast('Cannot delete the last remaining product.', { isError: true });
        return;
      }
      storeState.products = storeState.products.filter(p => p.id !== id);
      renderAdminProductList();
      renderCatalog(getCurrentCatalogFilter());
      injectStructuredDataSchema(storeState.products, storeState.settings);
      await savePersistentStoreState();
      showToast(`Deleted "${target.title}" from catalog.`);
    });
  });
}

function resetAdminProductForm() {
  document.getElementById('adminFormHeading').textContent = 'Add New Masterpiece';
  document.getElementById('adminEditProdId').value = '';
  document.getElementById('adminProdTitle').value = '';
  document.getElementById('adminProdCategory').value = 'garage';
  document.getElementById('adminProdStyleBadge').value = 'Matte Wood Cutout';
  document.getElementById('adminProdFinish').value = 'Matte Carbon Black (15mm Layered Wood)';
  document.getElementById('adminProdDesc').value = '';
  document.getElementById('adminProdPhotoUrl').value = 'assets/product-supercar-wall.jpg';
  document.getElementById('adminProdPreviewImg').src = 'assets/product-supercar-wall.jpg';
  document.getElementById('adminSizeSmallLabel').value = 'Small — 50 × 28 cm';
  document.getElementById('adminSizeSmallPrice').value = '58';
  document.getElementById('adminSizeMedLabel').value = 'Medium — 80 × 45 cm';
  document.getElementById('adminSizeMedPrice').value = '94';
  document.getElementById('adminSizeLargeLabel').value = 'Large — 115 × 64 cm';
  document.getElementById('adminSizeLargePrice').value = '138';
  pendingUploadedAdminPhoto = '';
}

function loadProductIntoAdminForm(prodId) {
  const prod = storeState.products.find(p => p.id === prodId);
  if (!prod) return;
  document.getElementById('adminFormHeading').textContent = `Editing: ${prod.title}`;
  document.getElementById('adminEditProdId').value = prod.id;
  document.getElementById('adminProdTitle').value = prod.title;
  document.getElementById('adminProdCategory').value = prod.category;
  document.getElementById('adminProdStyleBadge').value = prod.styleBadge;
  document.getElementById('adminProdFinish').value = prod.finish;
  document.getElementById('adminProdDesc').value = prod.description;
  document.getElementById('adminProdPhotoUrl').value = prod.image.startsWith('data:') ? '(Uploaded Custom Photo)' : prod.image;
  document.getElementById('adminProdPreviewImg').src = prod.image;
  pendingUploadedAdminPhoto = prod.image;

  const s0 = prod.sizes[0] || { label: 'Small', priceUSD: 55 };
  const s1 = prod.sizes[1] || { label: 'Medium', priceUSD: 90 };
  const s2 = prod.sizes[2] || { label: 'Large', priceUSD: 135 };

  document.getElementById('adminSizeSmallLabel').value = s0.label;
  document.getElementById('adminSizeSmallPrice').value = s0.priceUSD;
  document.getElementById('adminSizeMedLabel').value = s1.label;
  document.getElementById('adminSizeMedPrice').value = s1.priceUSD;
  document.getElementById('adminSizeLargeLabel').value = s2.label;
  document.getElementById('adminSizeLargePrice').value = s2.priceUSD;
}

export function populateAdminSettingsForm() {
  document.getElementById('adminWhatsAppNumber').value = storeState.settings.whatsappNumber || '96170360671';
  document.getElementById('adminPrimaryCurrencySymbol').value = storeState.settings.primaryCurrencySymbol || '$';
  document.getElementById('adminPrimaryCurrencyLabel').value = storeState.settings.primaryCurrencyLabel || 'USD $';
  document.getElementById('adminCalcCutoutBase').value = storeState.settings.calcCutoutBase ?? 28;
  document.getElementById('adminCalcCutoutPerCm').value = storeState.settings.calcCutoutPerCm ?? 0.95;
  document.getElementById('adminCalcReliefBase').value = storeState.settings.calcReliefBase ?? 45;
  document.getElementById('adminCalcReliefPerCm').value = storeState.settings.calcReliefPerCm ?? 1.45;
  document.getElementById('adminNewPin').value = '';
  document.getElementById('adminCloudWebhookUrl').value = storeState.settings.cloudWebhookUrl || '';
}

function optimizeImageFileToDataUrl(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 900;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(c.toDataURL('image/webp', 0.84));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function initProductManager() {
  const closeDrawerBtn = document.getElementById('closeAdminDrawerBtn');
  if (closeDrawerBtn && !closeDrawerBtn.dataset.bound) {
    closeDrawerBtn.dataset.bound = 'true';
    closeDrawerBtn.addEventListener('click', closeAdminDrawer);
  }

  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      switchAdminTab(btn.getAttribute('data-admin-tab'));
    });
  });

  const newProdShortcut = document.getElementById('adminNewProductShortcutBtn');
  if (newProdShortcut && !newProdShortcut.dataset.bound) {
    newProdShortcut.dataset.bound = 'true';
    newProdShortcut.addEventListener('click', () => {
      resetAdminProductForm();
      switchAdminTab('add-product');
    });
  }

  const resetFormBtn = document.getElementById('adminResetFormBtn');
  if (resetFormBtn && !resetFormBtn.dataset.bound) {
    resetFormBtn.dataset.bound = 'true';
    resetFormBtn.addEventListener('click', resetAdminProductForm);
  }

  const photoFileInput = document.getElementById('adminProdPhotoFile');
  const photoUrlInput = document.getElementById('adminProdPhotoUrl');
  const previewImg = document.getElementById('adminProdPreviewImg');

  if (photoFileInput && !photoFileInput.dataset.bound) {
    photoFileInput.dataset.bound = 'true';
    photoFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const check = validateImageUpload(e.target.files[0]);
        if (!check.valid) {
          showToast(check.error, { isError: true });
          return;
        }
        optimizeImageFileToDataUrl(e.target.files[0], (dataUrl) => {
          pendingUploadedAdminPhoto = dataUrl;
          previewImg.src = dataUrl;
          photoUrlInput.value = '(Optimized WebP Image Ready)';
          showToast('Product photo compressed & optimized!');
        });
      }
    });
  }

  if (photoUrlInput && !photoUrlInput.dataset.bound) {
    photoUrlInput.dataset.bound = 'true';
    photoUrlInput.addEventListener('input', () => {
      const val = sanitizePlainText(photoUrlInput.value, 250);
      if (val && !val.startsWith('(')) {
        pendingUploadedAdminPhoto = val;
        previewImg.src = val;
      }
    });
  }

  const saveProdBtn = document.getElementById('adminSaveProductBtn');
  if (saveProdBtn && !saveProdBtn.dataset.bound) {
    saveProdBtn.dataset.bound = 'true';
    saveProdBtn.addEventListener('click', async () => {
      const editId = sanitizePlainText(document.getElementById('adminEditProdId').value, 60);
      const title = sanitizePlainText(document.getElementById('adminProdTitle').value, 100);
      if (!title) {
        showToast('Please enter a Product Title.', { isError: true });
        return;
      }
      const category = sanitizePlainText(document.getElementById('adminProdCategory').value, 30);
      const styleBadge = sanitizePlainText(document.getElementById('adminProdStyleBadge').value, 40);
      const badgeClass = styleBadge.includes('Relief') ? 'badge-relief' : 'badge-silhouette';
      const finish = sanitizePlainText(document.getElementById('adminProdFinish').value, 90) || 'Solid Hardwood • Hand-Finished';
      const description = sanitizePlainText(document.getElementById('adminProdDesc').value, 360) || 'Precision CNC-routed by Basma Studio (@basma.llb).';
      const urlVal = sanitizePlainText(document.getElementById('adminProdPhotoUrl').value, 250);
      const image = pendingUploadedAdminPhoto || (urlVal && !urlVal.startsWith('(') ? urlVal : 'assets/product-supercar-wall.jpg');

      const sLabel = sanitizePlainText(document.getElementById('adminSizeSmallLabel').value, 50) || 'Small';
      const sPrice = Math.max(1, parseInt(document.getElementById('adminSizeSmallPrice').value || '55', 10));
      const mLabel = sanitizePlainText(document.getElementById('adminSizeMedLabel').value, 50) || 'Medium';
      const mPrice = Math.max(1, parseInt(document.getElementById('adminSizeMedPrice').value || '90', 10));
      const lLabel = sanitizePlainText(document.getElementById('adminSizeLargeLabel').value, 50) || 'Large';
      const lPrice = Math.max(1, parseInt(document.getElementById('adminSizeLargePrice').value || '135', 10));

      const prodObj = {
        id: editId || ('prod-custom-' + Date.now()),
        title,
        category,
        styleBadge,
        badgeClass,
        image,
        finish,
        description,
        sizes: [
          { label: sLabel, code: 'S', priceUSD: sPrice },
          { label: mLabel, code: 'M', priceUSD: mPrice },
          { label: lLabel, code: 'L', priceUSD: lPrice }
        ],
        defaultSizeIndex: 1
      };

      if (editId) {
        const idx = storeState.products.findIndex(p => p.id === editId);
        if (idx !== -1) storeState.products[idx] = prodObj;
      } else {
        storeState.products.unshift(prodObj);
      }

      renderAdminProductList();
      renderCatalog(getCurrentCatalogFilter());
      injectStructuredDataSchema(storeState.products, storeState.settings);
      await savePersistentStoreState();
      switchAdminTab('products');
      showToast(`Saved "${title}" to live catalog!`, {
        image: prodObj.image,
        subMeta: `S: $${sPrice} • M: $${mPrice} • L: $${lPrice}`
      });
    });
  }

  const saveSettingsBtn = document.getElementById('adminSaveSettingsBtn');
  if (saveSettingsBtn && !saveSettingsBtn.dataset.bound) {
    saveSettingsBtn.dataset.bound = 'true';
    saveSettingsBtn.addEventListener('click', async () => {
      storeState.settings.whatsappNumber = sanitizePhoneDigits(document.getElementById('adminWhatsAppNumber').value);
      storeState.settings.primaryCurrencySymbol = sanitizePlainText(document.getElementById('adminPrimaryCurrencySymbol').value, 10) || '$';
      storeState.settings.primaryCurrencyLabel = sanitizePlainText(document.getElementById('adminPrimaryCurrencyLabel').value, 16) || 'USD $';
      storeState.settings.calcCutoutBase = parseFloat(document.getElementById('adminCalcCutoutBase').value || '28');
      storeState.settings.calcCutoutPerCm = parseFloat(document.getElementById('adminCalcCutoutPerCm').value || '0.95');
      storeState.settings.calcReliefBase = parseFloat(document.getElementById('adminCalcReliefBase').value || '45');
      storeState.settings.calcReliefPerCm = parseFloat(document.getElementById('adminCalcReliefPerCm').value || '1.45');
      storeState.settings.cloudWebhookUrl = sanitizePlainText(document.getElementById('adminCloudWebhookUrl').value, 240);

      const newPinRaw = (document.getElementById('adminNewPin').value || '').trim();
      if (newPinRaw.length >= 4) {
        storeState.settings.adminPinHash = await sha256Hex(newPinRaw);
      } else if (!storeState.settings.adminPinHash) {
        storeState.settings.adminPinHash = DEFAULT_PIN_SHA256;
      }

      await applyStoreSnapshot(getStoreSnapshot());
      updateSizeCalculator();
      renderCatalog(getCurrentCatalogFilter());
      injectStructuredDataSchema(storeState.products, storeState.settings);
      await savePersistentStoreState();
      showToast('Global store & calculator settings saved!', {
        subMeta: `WhatsApp: +${storeState.settings.whatsappNumber}`
      });
    });
  }

  const exportBtn = document.getElementById('adminExportJsonBtn');
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.dataset.bound = 'true';
    exportBtn.addEventListener('click', () => {
      const dataStr = JSON.stringify(getStoreSnapshot(), null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'store-state.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Exported store-state.json snapshot!');
    });
  }

  const importInput = document.getElementById('adminImportJsonInput');
  if (importInput && !importInput.dataset.bound) {
    importInput.dataset.bound = 'true';
    importInput.addEventListener('change', (e) => {
      if (!e.target.files || !e.target.files[0]) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          await applyStoreSnapshot(parsed);
          renderAdminProductList();
          populateAdminSettingsForm();
          renderCatalog(getCurrentCatalogFilter());
          updateSizeCalculator();
          await savePersistentStoreState();
          showToast('Imported & applied store-state.json snapshot!');
        } catch (_) {
          showToast('Invalid JSON snapshot file.', { isError: true });
        }
      };
      reader.readAsText(e.target.files[0]);
    });
  }

  const resetDefaultsBtn = document.getElementById('adminResetDefaultsBtn');
  if (resetDefaultsBtn && !resetDefaultsBtn.dataset.bound) {
    resetDefaultsBtn.dataset.bound = 'true';
    resetDefaultsBtn.addEventListener('click', async () => {
      await resetStoreToFactoryDefaults();
      renderAdminProductList();
      populateAdminSettingsForm();
      renderCatalog(getCurrentCatalogFilter());
      updateSizeCalculator();
      showToast('Store reset to factory defaults.');
    });
  }
}
