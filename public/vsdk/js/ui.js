// ── UI UTILITIES ──────────────────────────────────────────────────────────────

import { DOM } from './dom.js';

/** Lobby veya Room ekranını gösterir, diğerini gizler. */
export function switchScreen(screen) {
  if (screen === 'room') {
    DOM.lobbyScreen.classList.remove('active');
    DOM.roomScreen.classList.add('active');
    DOM.lobbyScreen.setAttribute('aria-hidden', 'true');
    DOM.roomScreen.removeAttribute('aria-hidden');
  } else {
    DOM.roomScreen.classList.remove('active');
    DOM.lobbyScreen.classList.add('active');
    DOM.roomScreen.setAttribute('aria-hidden', 'true');
    DOM.lobbyScreen.removeAttribute('aria-hidden');
  }
}

/**
 * Sağ üst köşede bir toast bildirimi gösterir.
 * @param {string} title
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration — ms cinsinden otomatik kapanma süresi
 */
export function showToast(title, message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.classList.add('toast', `toast--${type}`);
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast__dot" aria-hidden="true"></div>
    <div class="toast__body">
      <div class="toast__title">${title}</div>
      <div class="toast__msg">${message}</div>
    </div>
  `;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/** Lobby'deki SDK durum banner'ını günceller. */
export function setSDKStatus(state, text) {
  DOM.sdkStatusBanner.className = `status-banner status-banner--${state}`;
  DOM.sdkStatusText.textContent = text;
}

/** Tam ekran loading overlay'i gösterir. */
export function showLoading(message = 'Loading…') {
  DOM.loadingMessage.textContent = message;
  DOM.loadingOverlay.classList.add('visible');
  DOM.loadingOverlay.removeAttribute('aria-hidden');
}

/** Loading overlay'i gizler. */
export function hideLoading() {
  DOM.loadingOverlay.classList.remove('visible');
  DOM.loadingOverlay.setAttribute('aria-hidden', 'true');
}

/** Lobby'deki Create/Join tab'ını değiştirir. */
export function switchTab(tab) {
  const isCreate = tab === 'create';
  DOM.tabCreate.classList.toggle('active', isCreate);
  DOM.tabJoin.classList.toggle('active', !isCreate);
  DOM.tabCreate.setAttribute('aria-selected', isCreate);
  DOM.tabJoin.setAttribute('aria-selected', !isCreate);
  DOM.panelCreate.classList.toggle('active', isCreate);
  DOM.panelJoin.classList.toggle('active', !isCreate);
}
