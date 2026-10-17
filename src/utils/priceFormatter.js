/**
 * BASMA (@basma.llb) — Currency Conversion & Animated Price Counter Utility
 */

export const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1, label: 'USD $' },
  { code: 'EUR', symbol: '€', rate: 0.92, label: 'EUR €' },
  { code: 'AED', symbol: 'AED ', rate: 3.67, label: 'AED' }
];

export function formatPrice(usdAmount, currencyIndex = 0) {
  const curr = CURRENCIES[currencyIndex] || CURRENCIES[0];
  const numeric = Number(usdAmount) || 0;
  const converted = Math.round(numeric * curr.rate);
  return `${curr.symbol}${converted}`;
}

const counterAnimations = new WeakMap();

export function animatePriceElement(el, targetUsd, currencyIndex = 0) {
  if (!el) return;
  const prevUsd = parseFloat(el.getAttribute('data-usd') || targetUsd);
  el.setAttribute('data-usd', targetUsd);

  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (Math.abs(prevUsd - targetUsd) < 0.5 || prefersReduced) {
    el.textContent = formatPrice(targetUsd, currencyIndex);
    return;
  }

  const prevAnim = counterAnimations.get(el);
  if (prevAnim) cancelAnimationFrame(prevAnim);

  const duration = 260;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const currentVal = prevUsd + (targetUsd - prevUsd) * eased;
    el.textContent = formatPrice(currentVal, currencyIndex);
    if (progress < 1) {
      counterAnimations.set(el, requestAnimationFrame(step));
    } else {
      el.textContent = formatPrice(targetUsd, currencyIndex);
    }
  }
  counterAnimations.set(el, requestAnimationFrame(step));
}
