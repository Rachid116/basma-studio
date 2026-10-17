/**
 * BASMA (@basma.llb) — “The Craft” Process Showcase & Interactive Raw Wood to 3D Carve Slider
 */

export function initCraftProcess() {
  const stage = document.getElementById('carveCompareStage');
  const beforeLayer = document.getElementById('compareBeforeLayer');
  const handle = document.getElementById('compareHandle');
  if (!stage || !beforeLayer || !handle) return;

  let isDragging = false;

  function setSliderPercent(pct) {
    const clamped = Math.max(4, Math.min(96, pct));
    beforeLayer.style.clipPath = `inset(0 ${(100 - clamped).toFixed(2)}% 0 0)`;
    handle.style.left = `${clamped.toFixed(2)}%`;
    handle.setAttribute('aria-valuenow', Math.round(clamped));
  }

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

  const stopSlide = () => { isDragging = false; };
  stage.addEventListener('pointerup', stopSlide);
  stage.addEventListener('pointercancel', stopSlide);

  handle.addEventListener('keydown', (e) => {
    const current = parseFloat(handle.getAttribute('aria-valuenow') || '50');
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPercent(current - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPercent(current + 5);
    }
  });
}
