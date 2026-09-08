// ── MEDIA CONTROLS ────────────────────────────────────────────────────────────
// Mikrofon ve kamera toggle butonlarının mantığı.

import { AppState } from './state.js';
import { DOM } from './dom.js';
import { setMicMute, setVideoEnabled } from './sdk.js';

export async function onToggleMic() {
  AppState.isMicMuted = !AppState.isMicMuted;
  await setMicMute(AppState.isMicMuted);
  updateControlButtonUI();
  updateLocalTileStatus();
}

export async function onToggleVideo() {
  AppState.isVideoOff = !AppState.isVideoOff;
  await setVideoEnabled(!AppState.isVideoOff);
  const localP = AppState.participants.get(AppState.localUserId);
  if (localP) localP.tileEl.classList.toggle('video-tile--video-off', AppState.isVideoOff);
  updateControlButtonUI();
}

/** Mic ve video butonlarının aria attribute + data-state + label'ını günceller. */
export function updateControlButtonUI() {
  const micBtn = DOM.btnToggleMic;
  micBtn.dataset.state = AppState.isMicMuted ? 'off' : 'on';
  micBtn.setAttribute('aria-pressed', AppState.isMicMuted);
  micBtn.setAttribute('aria-label', AppState.isMicMuted ? 'Unmute microphone' : 'Mute microphone');
  micBtn.querySelector('.ctrl-btn-label').textContent = AppState.isMicMuted ? 'Unmute' : 'Mute';

  const vidBtn = DOM.btnToggleVideo;
  vidBtn.dataset.state = AppState.isVideoOff ? 'off' : 'on';
  vidBtn.setAttribute('aria-pressed', AppState.isVideoOff);
  vidBtn.setAttribute('aria-label', AppState.isVideoOff ? 'Turn on camera' : 'Turn off camera');
  vidBtn.querySelector('.ctrl-btn-label').textContent = AppState.isVideoOff ? 'Start Video' : 'Stop Video';
}

/** Local tile'daki mic ikonunu mute durumuna göre günceller. */
export function updateLocalTileStatus() {
  const localP = AppState.participants.get(AppState.localUserId);
  if (!localP) return;
  const micIcon = localP.tileEl.querySelector('.tile-mic-icon');
  if (micIcon) micIcon.classList.toggle('tile-status-icon--muted', AppState.isMicMuted);
}
