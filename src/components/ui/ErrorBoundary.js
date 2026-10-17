/**
 * BASMA (@basma.llb) — Global Runtime Error Boundary
 * Prevents unhandled promise rejections or DOM exceptions from breaking interactive studios.
 */

import { showToast } from './ToastNotifications.js';

export function initErrorBoundary() {
  window.addEventListener('error', (event) => {
    event.preventDefault();
    showToast('Studio recovered from a minor display glitch.', { isError: true });
  });

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
  });
}
