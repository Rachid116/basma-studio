/**
 * BASMA (@basma.llb) — “The Craft” Process Showcase & Interactive Raw Wood to 3D Carve Slider
 */

export function initCraftProcess() {
  const stage = document.getElementById('carveCompareStage');
  const beforeLayer = document.getElementById('compareBeforeLayer');
  const divider = document.getElementById('compareSpindleDivider') || document.getElementById('compareHandle');
  const rangeInput = document.getElementById('carveCompareRangeInput');

  if (!stage || !beforeLayer || !divider) return;

  function setSliderPercent(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    beforeLayer.style.clipPath = `inset(0 ${(100 - clamped).toFixed(2)}% 0 0)`;
    divider.style.left = `${clamped.toFixed(2)}%`;
    divider.setAttribute('aria-valuenow', Math.round(clamped));
    if (rangeInput && Number(rangeInput.value) !== Math.round(clamped)) {
      rangeInput.value = Math.round(clamped);
    }
  }

  // 1. Native HTML5 range input (60 FPS hardware-accelerated touch & drag on iOS, Android & Desktop)
  if (rangeInput) {
    const handleRangeChange = (e) => {
      setSliderPercent(Number(e.target.value));
    };
    rangeInput.addEventListener('input', handleRangeChange);
    rangeInput.addEventListener('change', handleRangeChange);
  }

  // 2. Direct Pointer & Touch Events as complementary drag handler
  let isDragging = false;

  function updateFromClientX(clientX) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPercent(pct);
  }

  stage.addEventListener('pointerdown', (e) => {
    isDragging = true;
    updateFromClientX(e.clientX);
    if (stage.setPointerCapture) {
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  stage.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    updateFromClientX(e.clientX);
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      if (stage.releasePointerCapture && e && e.pointerId) {
        try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    }
  };
  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);

  // Keyboard accessibility
  divider.addEventListener('keydown', (e) => {
    const current = parseFloat(divider.getAttribute('aria-valuenow') || '50');
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPercent(current - 4);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPercent(current + 4);
    }
  });

  // Initial state: 50% split
  setSliderPercent(50);
}
