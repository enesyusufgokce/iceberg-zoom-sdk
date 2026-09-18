// ── BOOTSTRAP (Entry Point) ───────────────────────────────────────────────────
// Uygulamayı başlatır. index.html'de <script type="module" src="js/main.js"> ile yüklenir.

import { initEventListeners } from './listeners.js';
import { setSDKStatus, switchScreen } from './ui.js';

function bootstrap() {
  initEventListeners();
  setSDKStatus('idle', 'SDK Not Initialized');
  switchScreen('lobby');

  console.info(
    '%c ZoomSDK POC %c Ready ',
    'background:#3b5bdb;color:#fff;font-weight:bold;padding:2px 8px;border-radius:4px 0 0 4px;',
    'background:#2b2b2b;color:#fff;padding:2px 8px;border-radius:0 4px 4px 0;'
  );
  console.info('Shortcuts: Alt+M mic | Alt+V video');
}

// <script type="module"> defer edildiğinden DOM genellikle hazır olur,
// ama güvenlik için her iki durumu da handle ediyoruz.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
