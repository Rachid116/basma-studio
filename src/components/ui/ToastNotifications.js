/**
 * BASMA (@basma.llb) — Rich Slide-In Toast Notification Component
 */

let toastTimeout = null;

export function showToast(msg, options = {}) {
  const toast = document.getElementById('toastNotification');
  const text = document.getElementById('toastMessage');
  const thumb = document.getElementById('toastThumb');
  const sparkle = document.getElementById('toastSparkle');
  const subMeta = document.getElementById('toastSubMeta');
  if (!toast || !text) return;

  text.textContent = msg;

  if (thumb && sparkle) {
    if (options.image) {
      thumb.src = options.image;
      thumb.alt = options.title || 'Basma product preview';
      thumb.style.display = 'block';
      sparkle.style.display = 'none';
    } else {
      thumb.style.display = 'none';
      sparkle.style.display = 'inline';
    }
  }

  if (subMeta) {
    if (options.subMeta) {
      subMeta.textContent = options.subMeta;
      subMeta.style.display = 'block';
    } else {
      subMeta.style.display = 'none';
    }
  }

  toast.classList.toggle('toast-error', !!options.isError);
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3400);
}
