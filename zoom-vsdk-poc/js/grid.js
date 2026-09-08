// ── VIDEO GRID LAYOUT ─────────────────────────────────────────────────────────
// Katılımcı sayısına göre CSS grid sütun sayısını dinamik olarak ayarlar.

import { AppState } from './state.js';
import { DOM } from './dom.js';

/**
 * Mevcut katılımcı sayısına göre --cols CSS custom property'sini günceller.
 *
 * | Katılımcı | Sütun |
 * |-----------|-------|
 * | 1         | 1     |
 * | 2–4       | 2     |
 * | 5–9       | 3     |
 * | 10–16     | 4     |
 * | 17+       | 5     |
 */
export function updateVideoGrid() {
  const count = AppState.participants.size;
  let cols = 1;
  if      (count <= 1)  cols = 1;
  else if (count <= 4)  cols = 2;
  else if (count <= 9)  cols = 3;
  else if (count <= 16) cols = 4;
  else                  cols = 5;
  DOM.videoGrid.style.setProperty('--cols', cols);
}
