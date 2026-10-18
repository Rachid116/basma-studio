/**
 * BASMA (@basma.llb) — “Carve Your Own” Custom Order Studio (HTML5 Canvas & Draggable Laser Text)
 */

import { storeState } from '../../services/storeService.js';
import { formatPrice, animatePriceElement } from '../../utils/priceFormatter.js';
import { sanitizePlainText, validateImageUpload } from '../../utils/sanitize.js';
import { buildCustomSpecSheetMessage, buildWhatsAppUrl } from '../../utils/whatsappBuilder.js';
import { renderCartDrawer, openCartDrawer } from '../ui/Modals.js';
import { showToast } from '../ui/ToastNotifications.js';

export const customState = {
  fileName: 'Sacred Medallion Heritage Sample',
  imageSrc: 'assets/product-heritage-relief.jpg',
  carveStyle: 'relief',
  depthIntensity: 75,
  woodFinish: 'walnut',
  woodLabel: 'Rich Walnut',
  widthCm: 60,
  heightCm: 45,
  engraving: 'Crafted by Basma | بصمة',
  engravingPos: { x: 0, y: 0 },
  estimatedUSD: 138
};

let loadedCanvasImage = null;

export function renderCustomCarveCanvas() {
  const canvas = document.getElementById('customCarveCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const finishPalettes = {
    walnut: ['#6E4726', '#4E3119', '#382210'],
    oak: ['#D8B27E', '#BA8D54', '#986C36'],
    cedar: ['#A85734', '#853F20', '#642B12'],
    carbon: ['#EFE9DC', '#E2DAC8', '#D4C9B3']
  };
  const pal = finishPalettes[customState.woodFinish] || finishPalettes.walnut;
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, pal[0]);
  bgGrad.addColorStop(0.55, pal[1]);
  bgGrad.addColorStop(1, pal[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = customState.woodFinish === 'carbon' ? 0.04 : 0.12;
  ctx.strokeStyle = '#1A0D04';
  ctx.lineWidth = 1.2;
  for (let y = 6; y < h; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + ((y % 18) - 9), w * 0.7, y - ((y % 14) - 7), w, y + 2);
    ctx.stroke();
  }
  ctx.restore();

  if (!loadedCanvasImage || !loadedCanvasImage.complete || !loadedCanvasImage.naturalWidth) {
    return;
  }

  const pad = 34;
  const availW = w - pad * 2;
  const availH = h - pad * 2 - 22;
  const imgRatio = loadedCanvasImage.naturalWidth / loadedCanvasImage.naturalHeight;
  let drawW = availW;
  let drawH = drawW / imgRatio;
  if (drawH > availH) {
    drawH = availH;
    drawW = drawH * imgRatio;
  }
  const drawX = Math.round((w - drawW) / 2);
  const drawY = Math.round((h - drawH) / 2) - 8;

  const offCanvas = document.createElement('canvas');
  const procW = Math.max(80, Math.min(320, Math.round(drawW)));
  const procH = Math.max(60, Math.min(240, Math.round(drawH)));
  offCanvas.width = procW;
  offCanvas.height = procH;
  const offCtx = offCanvas.getContext('2d');
  offCtx.drawImage(loadedCanvasImage, 0, 0, procW, procH);

  try {
    const imgData = offCtx.getImageData(0, 0, procW, procH);
    const data = imgData.data;
    const outData = offCtx.createImageData(procW, procH);
    const out = outData.data;
    const intensity = (customState.depthIntensity || 75) / 100;

    if (customState.carveStyle === 'silhouette') {
      const threshold = 215 - intensity * 130;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const alpha = data[i + 3];
        if (alpha > 30 && lum < threshold) {
          out[i] = 20;
          out[i + 1] = 20;
          out[i + 2] = 20;
          out[i + 3] = 255;
        } else {
          out[i + 3] = 0;
        }
      }
      offCtx.putImageData(outData, 0, 0);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
      ctx.shadowOffsetX = 8;
      ctx.shadowOffsetY = 12;
      ctx.shadowBlur = 10;
      ctx.drawImage(offCanvas, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      const tintColors = {
        walnut: { r: 112, g: 72, b: 38 },
        oak: { r: 196, g: 152, b: 96 },
        cedar: { r: 162, g: 82, b: 46 },
        carbon: { r: 58, g: 56, b: 54 }
      };
      const tint = tintColors[customState.woodFinish] || tintColors.walnut;
      const bumpStrength = 0.8 + intensity * 1.9;

      for (let y = 0; y < procH; y++) {
        for (let x = 0; x < procW; x++) {
          const idx = (y * procW + x) * 4;
          const prevIdx = (Math.max(0, y - 1) * procW + Math.max(0, x - 1)) * 4;
          const nextIdx = (Math.min(procH - 1, y + 1) * procW + Math.min(procW - 1, x + 1)) * 4;

          const lumCurr = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          const lumPrev = 0.299 * data[prevIdx] + 0.587 * data[prevIdx + 1] + 0.114 * data[prevIdx + 2];
          const lumNext = 0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];

          const slope = (lumPrev - lumNext) * bumpStrength;
          const normalizedLum = lumCurr / 255;
          const shade = (normalizedLum * 0.72 + 0.28) + (slope / 255);

          out[idx] = Math.max(12, Math.min(255, Math.round(tint.r * shade + slope * 0.25)));
          out[idx + 1] = Math.max(8, Math.min(255, Math.round(tint.g * shade + slope * 0.2)));
          out[idx + 2] = Math.max(5, Math.min(255, Math.round(tint.b * shade + slope * 0.14)));
          out[idx + 3] = 248;
        }
      }
      offCtx.putImageData(outData, 0, 0);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 8, 3, 0.42)';
      ctx.fillRect(drawX - 6, drawY - 6, drawW + 12, drawH + 12);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;
      ctx.shadowBlur = 8;
      ctx.drawImage(offCanvas, drawX, drawY, drawW, drawH);
      ctx.strokeStyle = 'rgba(255, 226, 160, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
      ctx.restore();
    }
  } catch (_) {
    ctx.save();
    ctx.drawImage(loadedCanvasImage, drawX, drawY, drawW, drawH);
    ctx.restore();
  }
}

function loadCanvasReferenceImage(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    loadedCanvasImage = img;
    renderCustomCarveCanvas();
  };
  img.src = src;
}

export function updateCustomConfiguratorEstimate() {
  const wInput = document.getElementById('customWidthInput');
  const hInput = document.getElementById('customHeightInput');
  const engInput = document.getElementById('customEngravingInput');
  const charLimit = Number(storeState.settings?.customizerSettings?.engravingCharLimit) || 60;

  if (wInput) customState.widthCm = Math.max(25, Math.min(150, parseInt(wInput.value || '60', 10)));
  if (hInput) customState.heightCm = Math.max(20, Math.min(150, parseInt(hInput.value || '45', 10)));
  if (engInput) {
    engInput.maxLength = charLimit;
    customState.engraving = sanitizePlainText(engInput.value || '', charLimit);
  }

  const liveEngravingPreview = document.getElementById('liveEngravingPreview');
  const liveEngravingText = document.getElementById('liveEngravingText');
  if (liveEngravingPreview) {
    if (customState.engraving) {
      liveEngravingPreview.style.display = 'inline-flex';
      if (liveEngravingText) {
        liveEngravingText.textContent = `“${customState.engraving}”`;
      } else {
        liveEngravingPreview.textContent = `“${customState.engraving}”`;
      }
    } else {
      liveEngravingPreview.style.display = 'none';
    }
  }

  const styleLabel = customState.carveStyle === 'relief' ? 'Deep 3D CNC Relief' : 'Matte Black Silhouette';
  const summaryStyle = document.getElementById('summaryStyleText');
  const summaryWood = document.getElementById('summaryWoodText');
  const summaryDims = document.getElementById('summaryDimsText');
  const previewBadge = document.getElementById('customPreviewBadge');

  if (summaryStyle) summaryStyle.textContent = styleLabel;
  if (summaryWood) summaryWood.textContent = customState.woodLabel;
  if (summaryDims) summaryDims.textContent = `${customState.widthCm} × ${customState.heightCm} cm`;
  if (previewBadge) previewBadge.textContent = `${styleLabel} • ${customState.woodLabel}`;

  const areaSqCm = customState.widthCm * customState.heightCm;
  const ratePerSqCm = customState.carveStyle === 'relief' ? 0.032 : 0.021;
  const mults = storeState.settings?.woodMultipliers || { walnut: 1.25, oak: 1.0, cedar: 1.15, carbon: 1.1 };
  const activeMult = Number(mults[customState.woodFinish]) || 1.0;
  const woodPremium = customState.woodFinish === 'walnut' || customState.woodFinish === 'cedar' ? 18 : 8;
  const configuredEngPrice = storeState.settings?.customizerSettings?.engravingPriceUSD;
  const engravingFee = customState.engraving.length > 0
    ? (configuredEngPrice !== undefined ? Number(configuredEngPrice) : 10)
    : 0;

  const basePiece = (42 + areaSqCm * ratePerSqCm + woodPremium) * (activeMult / 1.15);
  customState.estimatedUSD = Math.round(basePiece + engravingFee);
  const estEl = document.getElementById('customEstimatePrice');
  if (estEl) animatePriceElement(estEl, customState.estimatedUSD, storeState.currentCurrencyIndex);
}

export function initCustomStudio() {
  const fileInput = document.getElementById('customFileInput');
  const dropzone = document.getElementById('customDropzone');
  const uploadedImg = document.getElementById('customUploadedImg');
  const uploadFileName = document.getElementById('uploadFileName');
  const uploadStatusMsg = document.getElementById('customUploadStatusMsg');
  const woodBoard = document.getElementById('customWoodBoard');
  const depthSlider = document.getElementById('customDepthIntensity');
  const depthVal = document.getElementById('customDepthVal');
  const liveEngravingPreview = document.getElementById('liveEngravingPreview');
  const resetEngravingPosBtn = document.getElementById('resetEngravingPosBtn');

  function handleUploadedFile(file) {
    const check = validateImageUpload(file);
    if (!check.valid) {
      if (uploadStatusMsg) {
        uploadStatusMsg.textContent = `⚠️ ${check.error}`;
        uploadStatusMsg.className = 'form-status-msg error';
        uploadStatusMsg.style.display = 'block';
      }
      showToast(check.error, { isError: true });
      return;
    }

    customState.fileName = sanitizePlainText(file.name, 70);
    if (uploadFileName) uploadFileName.textContent = `✓ Loaded: ${customState.fileName}`;
    if (uploadStatusMsg) {
      uploadStatusMsg.textContent = `✓ "${customState.fileName}" rendered on Live CNC Canvas.`;
      uploadStatusMsg.className = 'form-status-msg success';
      uploadStatusMsg.style.display = 'block';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      customState.imageSrc = e.target.result;
      if (uploadedImg) uploadedImg.src = e.target.result;
      loadCanvasReferenceImage(e.target.result);
      showToast('Photo rendered on Live CNC Wood Canvas!', {
        image: e.target.result,
        subMeta: `${customState.carveStyle === 'relief' ? '3D Relief Depth Map' : 'Matte Black Stencil'}`
      });
    };
    reader.readAsDataURL(file);
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleUploadedFile(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleUploadedFile(e.dataTransfer.files[0]);
      }
    });
  }

  document.querySelectorAll('[data-sample-img]').forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleSrc = chip.getAttribute('data-sample-img');
      customState.imageSrc = sampleSrc;
      customState.fileName = sanitizePlainText(chip.textContent.trim(), 60);
      if (uploadedImg) uploadedImg.src = sampleSrc;
      if (uploadFileName) uploadFileName.textContent = `✓ Sample Selected: ${customState.fileName}`;
      if (uploadStatusMsg) uploadStatusMsg.style.display = 'none';
      loadCanvasReferenceImage(sampleSrc);
    });
  });

  const styleBtns = document.querySelectorAll('[data-custom-style]');
  styleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      customState.carveStyle = btn.getAttribute('data-custom-style');
      styleBtns.forEach(b => b.classList.toggle('active', b === btn));
      if (woodBoard) woodBoard.setAttribute('data-carve-style', customState.carveStyle);
      renderCustomCarveCanvas();
      updateCustomConfiguratorEstimate();
    });
  });

  if (depthSlider) {
    depthSlider.addEventListener('input', () => {
      customState.depthIntensity = parseInt(depthSlider.value, 10);
      if (depthVal) depthVal.textContent = `${customState.depthIntensity}%`;
      renderCustomCarveCanvas();
    });
  }

  const finishBtns = document.querySelectorAll('[data-wood-finish]');
  finishBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      customState.woodFinish = btn.getAttribute('data-wood-finish');
      customState.woodLabel = btn.getAttribute('data-wood-label');
      finishBtns.forEach(b => b.classList.toggle('active', b === btn));
      if (woodBoard) woodBoard.setAttribute('data-finish', customState.woodFinish);
      renderCustomCarveCanvas();
      updateCustomConfiguratorEstimate();
    });
  });

  ['customWidthInput', 'customHeightInput', 'customEngravingInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCustomConfiguratorEstimate);
  });

  if (liveEngravingPreview && woodBoard) {
    let draggingEngraving = false;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    liveEngravingPreview.addEventListener('pointerdown', (e) => {
      draggingEngraving = true;
      liveEngravingPreview.classList.add('is-dragging');
      startX = e.clientX;
      startY = e.clientY;
      origX = customState.engravingPos.x;
      origY = customState.engravingPos.y;
      if (liveEngravingPreview.setPointerCapture) {
        try { liveEngravingPreview.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    liveEngravingPreview.addEventListener('pointermove', (e) => {
      if (!draggingEngraving) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      customState.engravingPos.x = Math.max(-95, Math.min(95, origX + dx));
      customState.engravingPos.y = Math.max(-165, Math.min(10, origY + dy));
      liveEngravingPreview.style.transform = `translate(calc(-50% + ${customState.engravingPos.x}px), ${customState.engravingPos.y}px)`;
    });

    const endEngraveDrag = () => {
      draggingEngraving = false;
      liveEngravingPreview.classList.remove('is-dragging');
    };
    liveEngravingPreview.addEventListener('pointerup', endEngraveDrag);
    liveEngravingPreview.addEventListener('pointercancel', endEngraveDrag);

    if (resetEngravingPosBtn) {
      resetEngravingPosBtn.addEventListener('click', () => {
        customState.engravingPos = { x: 0, y: 0 };
        liveEngravingPreview.style.transform = 'translateX(-50%)';
      });
    }
  }

  const addCustomToCartBtn = document.getElementById('addCustomToCartBtn');
  if (addCustomToCartBtn) {
    addCustomToCartBtn.addEventListener('click', () => {
      updateCustomConfiguratorEstimate();
      const styleName = customState.carveStyle === 'relief' ? 'Custom 3D CNC Relief' : 'Custom Matte Silhouette';
      const canvas = document.getElementById('customCarveCanvas');
      let previewThumb = customState.imageSrc;
      try {
        if (canvas) previewThumb = canvas.toDataURL('image/jpeg', 0.82);
      } catch (_) {}

      const itemTitle = `${styleName} (${customState.fileName})`;
      storeState.cart.push({
        cartItemId: 'custom-' + Date.now(),
        productId: 'custom-commission',
        title: itemTitle,
        style: styleName,
        sizeLabel: `${customState.widthCm} × ${customState.heightCm} cm`,
        finish: `${customState.woodLabel}${customState.engraving ? ` • Engraved: "${customState.engraving}"` : ''}`,
        priceUSD: customState.estimatedUSD,
        qty: 1,
        image: previewThumb,
        isCustom: true
      });
      renderCartDrawer();
      openCartDrawer();
      showToast('Custom commission added to your Basma bag!', {
        image: previewThumb,
        title: itemTitle,
        subMeta: `${customState.widthCm}×${customState.heightCm}cm • ${formatPrice(customState.estimatedUSD, storeState.currentCurrencyIndex)}`
      });
    });
  }

  const sendCustomWhatsAppBtn = document.getElementById('sendCustomWhatsAppBtn');
  if (sendCustomWhatsAppBtn) {
    sendCustomWhatsAppBtn.addEventListener('click', () => {
      updateCustomConfiguratorEstimate();
      const formattedPrice = formatPrice(customState.estimatedUSD, storeState.currentCurrencyIndex);
      const message = buildCustomSpecSheetMessage(customState, formattedPrice);

      // Automatically capture custom quote inquiry in Leads (Admin Tab 5)
      try {
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: 'Custom Quote Visitor',
            phone: '',
            notes: `Wood: ${customState.woodLabel}, Engraving: "${customState.engraving || 'None'}"`,
            type: 'Custom Commission Quote',
            items: [{
              title: `Custom ${customState.carveStyle === 'relief' ? '3D CNC Relief' : 'Silhouette'} (${customState.fileName})`,
              style: customState.carveStyle,
              size: `${customState.widthCm} × ${customState.heightCm} cm`,
              finish: customState.woodLabel,
              priceUSD: customState.estimatedUSD,
              qty: 1
            }],
            totalUSD: customState.estimatedUSD,
            formattedPrice
          })
        }).catch(() => {});
      } catch (_) {}

      const waUrl = buildWhatsAppUrl(storeState.settings.whatsappNumber, message);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });
  }

  loadCanvasReferenceImage(customState.imageSrc);
  updateCustomConfiguratorEstimate();
}
