// ── SESSION TIMER ─────────────────────────────────────────────────────────────

import { AppState } from './state.js';
import { DOM } from './dom.js';

/** Room top bar'daki HH:MM:SS sayacını günceller. setInterval ile çağrılır. */
export function updateTimer() {
  if (!AppState.sessionStartTime) return;
  const elapsed = Math.floor((Date.now() - AppState.sessionStartTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  DOM.roomTimer.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
