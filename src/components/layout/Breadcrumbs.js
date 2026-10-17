/**
 * BASMA (@basma.llb) — Structured Breadcrumb Navigation Component
 * Updates breadcrumb trails across Catalog categories, Quick-View Modal, and Custom Studio.
 */

import { escapeHtml } from '../../utils/sanitize.js';

export function updateBreadcrumbTrail(crumbs = ['Home', 'All Masterpieces']) {
  const container = document.getElementById('catalogBreadcrumbList');
  if (!container) return;

  container.innerHTML = crumbs.map((label, idx) => {
    const isLast = idx === crumbs.length - 1;
    if (isLast) {
      return `<li class="breadcrumb-item active" aria-current="page">${escapeHtml(label)}</li>`;
    }
    const href = idx === 0 ? '#top' : '#collections';
    return `<li class="breadcrumb-item"><a href="${href}">${escapeHtml(label)}</a><span class="breadcrumb-sep">/</span></li>`;
  }).join('');
}

export function initBreadcrumbs() {
  updateBreadcrumbTrail(['Home', 'Collections', 'All Masterpieces']);
}
