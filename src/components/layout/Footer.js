/**
 * BASMA (@basma.llb) — Footer Component with Dynamic Year & Clickable Tel/WhatsApp/Mailto Links
 */

import { storeState } from '../../services/storeService.js';

export function syncContactAndWhatsAppLinks() {
  const cleanWa = String(storeState.settings.whatsappNumber || '96170360671').replace(/[^0-9]/g, '');
  const email = String(storeState.settings.studioEmail || 'concierge@basma-studio.com').trim();

  const floatWa = document.getElementById('floatingWhatsAppLink');
  if (floatWa) floatWa.href = `https://wa.me/${cleanWa}`;

  const footerWa = document.getElementById('footerWhatsAppLink');
  if (footerWa) {
    footerWa.href = `https://wa.me/${cleanWa}`;
    footerWa.textContent = `💬 WhatsApp Concierge: wa.me/${cleanWa}`;
  }

  const footerTel = document.getElementById('footerPhoneCallLink');
  if (footerTel) {
    footerTel.href = `tel:+${cleanWa}`;
  }

  const mobileTel = document.getElementById('mobilePhoneLink');
  if (mobileTel) {
    mobileTel.href = `tel:+${cleanWa}`;
  }

  const footerEmail = document.getElementById('footerEmailLink');
  if (footerEmail) {
    footerEmail.href = `mailto:${email}`;
    footerEmail.textContent = `✉️ ${email}`;
  }

  const mobileEmail = document.getElementById('mobileEmailLink');
  if (mobileEmail) {
    mobileEmail.href = `mailto:${email}`;
    mobileEmail.textContent = `✉️ ${email}`;
  }
}

export function initFooter() {
  const yearEl = document.getElementById('dynamicCopyrightYear');
  if (yearEl) {
    const currentYear = Math.max(2026, new Date().getFullYear());
    yearEl.textContent = String(currentYear);
  }
  syncContactAndWhatsAppLinks();
}
