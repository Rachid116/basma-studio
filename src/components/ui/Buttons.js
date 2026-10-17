/**
 * BASMA (@basma.llb) — 3D Perspective Tilt Physics & Magnetic Button Micro-Interactions
 */

export function attach3DTiltToElement(el, maxTiltDeg = 7) {
  if (!el || el.dataset.tiltBound === 'true') return;
  el.dataset.tiltBound = 'true';
  el.classList.add('tilt-3d-surface');

  let glare = el.querySelector('.tilt-glare-layer');
  if (!glare) {
    glare = document.createElement('div');
    glare.className = 'tilt-glare-layer';
    glare.setAttribute('aria-hidden', 'true');
    el.appendChild(glare);
  }

  let rafId = null;

  function handleMove(clientX, clientY) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const tiltX = ((0.5 - y) * maxTiltDeg * 2).toFixed(2);
    const tiltY = ((x - 0.5) * maxTiltDeg * 2).toFixed(2);
    const shadowX = ((0.5 - x) * 20).toFixed(1);
    const shadowY = (14 + (0.5 - y) * 16).toFixed(1);

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      el.classList.add('is-tilting');
      el.style.transform = `perspective(1100px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(1.01, 1.01, 1.01)`;
      el.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--tilt-shadow-x', `${shadowX}px`);
      el.style.setProperty('--tilt-shadow-y', `${shadowY}px`);
    });
  }

  function resetTilt() {
    if (rafId) cancelAnimationFrame(rafId);
    el.classList.remove('is-tilting');
    el.style.transform = '';
    el.style.setProperty('--tilt-shadow-x', '0px');
    el.style.setProperty('--tilt-shadow-y', '14px');
  }

  el.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    handleMove(e.clientX, e.clientY);
  });
  el.addEventListener('pointerleave', resetTilt);
}

export function init3DTiltAndMagneticButtons() {
  const heroCard = document.getElementById('heroShowcaseCard');
  if (heroCard) attach3DTiltToElement(heroCard, 5.5);

  document.querySelectorAll('.product-card').forEach(card => {
    attach3DTiltToElement(card, 7.0);
  });

  if (window.DeviceOrientationEvent && heroCard && !heroCard.dataset.gyroBound) {
    heroCard.dataset.gyroBound = 'true';
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma === null || e.beta === null) return;
      const tiltY = Math.max(-5, Math.min(5, e.gamma * 0.18));
      const tiltX = Math.max(-5, Math.min(5, (e.beta - 45) * 0.14));
      heroCard.style.transform = `perspective(1100px) rotateX(${-tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg)`;
      heroCard.style.setProperty('--glare-x', `${50 + tiltY * 6}%`);
      heroCard.style.setProperty('--glare-y', `${50 + tiltX * 6}%`);
    }, { passive: true });
  }

  document.querySelectorAll('.btn-primary-walnut, .btn-primary-gold, .btn-whatsapp, .magnetic-btn').forEach(btn => {
    if (btn.dataset.magneticBound === 'true') return;
    btn.dataset.magneticBound = 'true';

    btn.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = btn.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
      const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.22;
      btn.style.transform = `translate(${dx.toFixed(1)}px, ${(dy - 2).toFixed(1)}px)`;
    });

    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
    });
  });
}
