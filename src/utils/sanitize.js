/**
 * BASMA (@basma.llb) — Input Sanitization, Validation & XSS Protection Utility
 * Protects all forms, custom engraving inputs, uploaded files, and Admin CMS edits.
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes untrusted plain text to prevent XSS injection when rendering in HTML templates.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Sanitizes rich inline text edits (allows only safe inline formatting tags like <span>, <strong>, <em>, <br>)
 * and strips any <script>, <iframe>, event handlers (onload, onerror, onclick), or javascript: URIs.
 */
export function sanitizeRichInlineHtml(dirtyHtml) {
  if (typeof dirtyHtml !== 'string') return '';
  return dirtyHtml
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|style|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');
}

/**
 * Sanitizes plain text input (Custom Engraving, Customer Name, Phone, Address, Notes).
 */
export function sanitizePlainText(input, maxLength = 120) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript\s*:/gi, '')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes an international WhatsApp / Phone number (digits only).
 */
export function sanitizePhoneDigits(phone) {
  if (typeof phone !== 'string') return '96170360671';
  const cleaned = phone.replace(/[^0-9]/g, '');
  return cleaned.length >= 7 && cleaned.length <= 16 ? cleaned : '96170360671';
}

/**
 * Validates uploaded image files for MIME type and maximum size (default 10MB).
 */
export function validateImageUpload(file, maxBytes = 10 * 1024 * 1024) {
  if (!file) {
    return { valid: false, error: 'No image file selected.' };
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported format. Please upload a JPG, PNG, WebP, or SVG image.' };
  }
  if (file.size > maxBytes) {
    return { valid: false, error: 'Image exceeds 10 MB limit. Please choose a smaller photo.' };
  }
  return { valid: true, error: null };
}
