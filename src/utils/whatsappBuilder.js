/**
 * BASMA (@basma.llb) — WhatsApp Direct Concierge & Order Ticket Builder
 */

import { sanitizePlainText, sanitizePhoneDigits } from './sanitize.js';

export function buildWhatsAppUrl(phoneNumber, messageText) {
  const cleanPhone = sanitizePhoneDigits(phoneNumber);
  if (!messageText) {
    return `https://wa.me/${cleanPhone}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
}

export function buildCustomSpecSheetMessage(customState, formattedPrice) {
  const styleName = customState.carveStyle === 'relief'
    ? 'Deep 3D CNC Relief Carve'
    : 'Matte Black Wall Silhouette';

  return [
    '✨ *BASMA (بصمة | @basma.llb) — CUSTOM CARVE SPEC SHEET* ✨',
    '-----------------------------------------',
    `• *Reference Photo:* ${sanitizePlainText(customState.fileName, 80)}`,
    `• *Carving Technique:* ${styleName} (${customState.depthIntensity}% depth/contrast)`,
    `• *Wood & Finish:* ${sanitizePlainText(customState.woodLabel, 50)}`,
    `• *Dimensions:* ${customState.widthCm} cm (W) × ${customState.heightCm} cm (H)`,
    `• *Custom Engraving:* ${sanitizePlainText(customState.engraving, 60) || 'None'}`,
    `• *Estimated Studio Price:* ${formattedPrice}`,
    '-----------------------------------------',
    'Hello Basma Studio! I would like to commission this custom piece. I will attach my reference photo in this chat.'
  ].join('\n');
}

export function buildOrderTicketMessage({ cart, customer, formatPriceFn, totalUSD }) {
  const custName = sanitizePlainText(customer.name, 80) || 'Valued Client';
  const custPhone = sanitizePlainText(customer.phone, 40) || 'Provided via WhatsApp';
  const custAddress = sanitizePlainText(customer.address, 140) || 'To be confirmed';
  const custNotes = sanitizePlainText(customer.notes, 160);

  const itemsLines = cart.map((item, idx) =>
    `${idx + 1}. *${sanitizePlainText(item.title, 90)}* (×${item.qty})\n   • Size: ${sanitizePlainText(item.sizeLabel, 60)}\n   • Finish: ${sanitizePlainText(item.finish, 80)}\n   • Subtotal: ${formatPriceFn(item.priceUSD * item.qty)}`
  ).join('\n\n');

  return [
    '🪵 *NEW ORDER TICKET — BASMA (بصمة | @basma.llb)* 🪵',
    '=========================================',
    itemsLines,
    '=========================================',
    `💰 *TOTAL ORDER ESTIMATE:* ${formatPriceFn(totalUSD)}`,
    '💳 *Payment Method:* Cash on Delivery (COD)',
    '-----------------------------------------',
    '📦 *CUSTOMER DELIVERY DETAILS:*',
    `• *Name:* ${custName}`,
    `• *Phone:* ${custPhone}`,
    `• *Address:* ${custAddress}`,
    custNotes ? `• *Notes:* ${custNotes}` : null,
    '-----------------------------------------',
    'Please confirm my Basma order and estimated delivery date!'
  ].filter(Boolean).join('\n');
}
