/**
 * BASMA (@basma.llb) — Interactive Wall Vibe & Night Spotlight Room Simulator
 */

import { storeState } from '../../services/storeService.js';
import { addProductToCart, openCartDrawer } from '../ui/Modals.js';

const VIBE_PIECES = {
  supercar: {
    id: 'prod-aero-gt',
    title: 'Aero GT Hypercar Silhouette',
    depthTag: '15mm Floating Wall Standoff • Matte Carbon',
    renderHTML: `
      <svg viewBox="0 0 640 310" width="100%" height="auto" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aero GT Matte Black Supercar Wall Cutout Preview">
        <text x="320" y="34" text-anchor="middle" fill="currentColor" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700" letter-spacing="7" opacity="0.82">MORE THAN A CAR</text>
        <text x="320" y="55" text-anchor="middle" fill="currentColor" font-family="'Plus Jakarta Sans', sans-serif" font-size="9.5" font-weight="600" letter-spacing="4.5" opacity="0.65">A PASSION ON YOUR WALL</text>
        <g transform="translate(35, 65)">
          <path d="M125 22 L365 18 L345 30 L110 32 Z" fill="#141414"/>
          <path d="M165 30 L340 24 C420 26, 495 58, 535 98 C545 125, 542 162, 522 182 L470 185 C465 135, 430 105, 390 105 C350 105, 315 135, 308 188 L155 192 C142 155, 92 140, 48 122 L20 96 C65 78, 130 62, 225 56 L248 32 Z" fill="#141414"/>
          <path d="M255 38 C315 36, 368 48, 395 66 L310 68 L242 52 Z" fill="rgba(255,255,255,0.88)"/>
          <path d="M98 118 C155 96, 222 80, 290 74 C245 110, 198 145, 135 162 Z" fill="rgba(255,255,255,0.88)"/>
          <circle cx="322" cy="146" r="46" fill="#141414"/>
          <circle cx="322" cy="146" r="35" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="5"/>
          <path d="M322 108 L322 184 M284 146 L360 146 M295 119 L349 173 M349 119 L295 173" stroke="#141414" stroke-width="8"/>
          <circle cx="322" cy="146" r="11" fill="#C59B27"/>
        </g>
      </svg>
    `
  },
  anime: {
    id: 'prod-anime-samurai',
    title: 'Ronin Wolf & Katana Crest',
    depthTag: '18mm Dual-Layer Wood + Gold Accent',
    renderHTML: `
      <svg viewBox="0 0 540 310" width="100%" height="auto" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ronin Wolf and Katana Layered Wood Wall Art Preview">
        <g transform="translate(115, 5)">
          <path d="M155 24 C82 24, 24 82, 24 155 C24 228, 82 286, 155 286 C228 286, 286 228, 286 155 C286 122, 273 92, 252 69 C262 94, 264 122, 255 150 C238 206, 180 238, 124 221 C68 204, 36 146, 53 90 C66 48, 107 24, 155 24 Z" fill="#141414"/>
          <path d="M12 268 L298 38" stroke="#141414" stroke-width="11" stroke-linecap="round"/>
          <path d="M298 268 L12 38" stroke="#141414" stroke-width="11" stroke-linecap="round"/>
          <polygon points="155,58 222,132 196,232 155,204 114,232 88,132" fill="#141414" stroke="#C59B27" stroke-width="3"/>
          <polygon points="116,138 144,152 120,160" fill="#C59B27"/>
          <polygon points="194,138 166,152 190,160" fill="#C59B27"/>
          <polygon points="155,78 172,115 155,132 138,115" fill="#C59B27" opacity="0.85"/>
        </g>
      </svg>
    `
  },
  relief: {
    id: 'prod-sacred-relief',
    title: 'Sacred Medallion 3D CNC Relief',
    depthTag: '32mm Solid Carved Walnut Block',
    renderHTML: `
      <div style="display:flex; justify-content:center; align-items:center; padding: 0.5rem;">
        <div style="width: 245px; height: 245px; border-radius: 14px; overflow:hidden; border: 6px solid #5B381B; box-shadow: inset 0 0 22px rgba(0,0,0,0.65); background:#4E3119;">
          <img src="assets/product-heritage-relief.jpg" alt="Sacred Medallion 3D CNC Carved Solid Walnut Relief on Wall" loading="lazy" draggable="false" style="width:100%; height:100%; object-fit:cover; transform:scale(1.18);" />
        </div>
      </div>
    `
  }
};

let currentVibePieceKey = 'supercar';
let currentVibeLighting = 'daylight';
let vibeArtOffset = { x: 0, y: 0 };

export function initWallVibeStudio() {
  const wallStage = document.getElementById('vibeWallStage');
  const wallSwatches = document.querySelectorAll('[data-wall-swatch]');
  const activeWallLabel = document.getElementById('activeWallLabel');
  const vibeStageWallTag = document.getElementById('vibeStageWallTag');
  const vibeStageDepthTag = document.getElementById('vibeStageDepthTag');
  const pieceBtns = document.querySelectorAll('[data-vibe-piece]');
  const lightingBtns = document.querySelectorAll('[data-vibe-lighting]');
  const artworkHolder = document.getElementById('vibeArtworkHolder');
  const artworkRender = document.getElementById('vibeArtworkRender');
  const resetPosBtn = document.getElementById('vibeResetPosBtn');
  const sunlightSlider = document.getElementById('sunlightSlider');
  const sunlightAngleValue = document.getElementById('sunlightAngleValue');
  const sunbeamOverlay = document.getElementById('sunbeamOverlay');
  const addVibePieceBtn = document.getElementById('addVibePieceBtn');

  function updateSunlightShadow() {
    if (!sunlightSlider || !artworkRender) return;
    const angleDeg = parseInt(sunlightSlider.value, 10);
    const isNight = currentVibeLighting === 'night';

    const dragFactorX = Math.round(-vibeArtOffset.x * 0.08);
    const dragFactorY = Math.round(-vibeArtOffset.y * 0.08);

    const shadowX = Math.round(-angleDeg * (isNight ? 0.72 : 0.55)) + dragFactorX;
    const shadowY = Math.round((isNight ? 24 : 14) + Math.abs(angleDeg) * 0.25) + dragFactorY;
    const shadowBlur = Math.round((isNight ? 24 : 12) + Math.abs(angleDeg) * 0.22);

    artworkRender.style.setProperty('--art-shadow-x', `${shadowX}px`);
    artworkRender.style.setProperty('--art-shadow-y', `${shadowY}px`);
    artworkRender.style.setProperty('--art-shadow-blur', `${shadowBlur}px`);

    if (sunbeamOverlay) {
      sunbeamOverlay.style.setProperty('--sun-angle', `${115 + angleDeg}deg`);
    }

    if (wallStage) {
      const spotX = Math.max(20, Math.min(80, 50 + angleDeg * 0.55 + (vibeArtOffset.x / 5)));
      const spotY = Math.max(20, Math.min(75, 42 + (vibeArtOffset.y / 5)));
      wallStage.style.setProperty('--spot-x', `${spotX}%`);
      wallStage.style.setProperty('--spot-y', `${spotY}%`);
    }

    let desc = isNight ? 'Overhead Gallery Spot' : 'Zenith Overhead';
    if (angleDeg < -12) desc = isNight ? 'Warm Left Spot' : 'Morning Sun Left';
    else if (angleDeg > 12) desc = isNight ? 'Warm Right Spot' : 'Afternoon Golden Sun';
    if (sunlightAngleValue) {
      sunlightAngleValue.textContent = `${angleDeg > 0 ? '+' : ''}${angleDeg}° (${desc})`;
    }
  }

  function renderVibePiece() {
    const piece = VIBE_PIECES[currentVibePieceKey];
    if (!piece || !artworkRender) return;
    artworkRender.innerHTML = piece.renderHTML;
    if (vibeStageDepthTag) vibeStageDepthTag.textContent = piece.depthTag;
    updateSunlightShadow();
  }

  lightingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentVibeLighting = btn.getAttribute('data-vibe-lighting');
      lightingBtns.forEach(b => b.classList.toggle('active', b === btn));
      if (wallStage) wallStage.setAttribute('data-lighting', currentVibeLighting);
      updateSunlightShadow();
    });
  });

  if (artworkHolder && wallStage) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    artworkHolder.addEventListener('pointerdown', (e) => {
      if (e.target === resetPosBtn) return;
      isDragging = true;
      artworkHolder.classList.add('is-dragging');
      startX = e.clientX;
      startY = e.clientY;
      initialX = vibeArtOffset.x;
      initialY = vibeArtOffset.y;
      if (artworkHolder.setPointerCapture) {
        try { artworkHolder.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    artworkHolder.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      vibeArtOffset.x = Math.max(-110, Math.min(110, initialX + dx));
      vibeArtOffset.y = Math.max(-75, Math.min(65, initialY + dy));
      artworkHolder.style.transform = `translate3d(${vibeArtOffset.x}px, ${vibeArtOffset.y}px, 0)`;
      updateSunlightShadow();
    });

    const stopDrag = () => {
      if (!isDragging) return;
      isDragging = false;
      artworkHolder.classList.remove('is-dragging');
    };

    artworkHolder.addEventListener('pointerup', stopDrag);
    artworkHolder.addEventListener('pointercancel', stopDrag);

    if (resetPosBtn) {
      resetPosBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vibeArtOffset = { x: 0, y: 0 };
        artworkHolder.style.transform = 'translate3d(0px, 0px, 0)';
        updateSunlightShadow();
      });
    }
  }

  wallSwatches.forEach(btn => {
    btn.addEventListener('click', () => {
      const wallType = btn.getAttribute('data-wall-swatch');
      const wallName = btn.getAttribute('data-wall-name');
      wallSwatches.forEach(b => b.classList.toggle('active', b === btn));
      if (wallStage) wallStage.setAttribute('data-wall', wallType);
      if (activeWallLabel) activeWallLabel.textContent = wallName;
      if (vibeStageWallTag) vibeStageWallTag.textContent = `Wall: ${wallName}`;
    });
  });

  pieceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentVibePieceKey = btn.getAttribute('data-vibe-piece');
      pieceBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderVibePiece();
    });
  });

  if (sunlightSlider) {
    sunlightSlider.addEventListener('input', updateSunlightShadow);
  }

  if (addVibePieceBtn) {
    addVibePieceBtn.addEventListener('click', () => {
      const piece = VIBE_PIECES[currentVibePieceKey];
      const product = storeState.products.find(p => p.id === piece.id) || storeState.products[0];
      if (product) {
        addProductToCart(product, product.defaultSizeIndex);
        openCartDrawer();
      }
    });
  }

  renderVibePiece();
  updateSunlightShadow();
}
