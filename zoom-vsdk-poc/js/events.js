// ── SDK EVENT HANDLERS + BINDER ───────────────────────────────────────────────
// UI'ı SDK event'lerine tepki verecek şekilde günceller.
// bindSDKEvents() — session.js'deki enterRoom() tarafından join sonrası çağrılır.

import { AppState } from './state.js';
import { createVideoTile } from './tiles.js';
import { updateVideoGrid } from './grid.js';
import { updateParticipantsPanel, updateParticipantCount } from './participants.js';
import { showToast } from './ui.js';

// ── Handler'lar ───────────────────────────────────────────────────────────────

/** SDK event: 'user-added' — yeni katılımcı tile'ı oluşturur. */
export function handleParticipantJoined(participant) {
  console.info('[Event] Participant joined:', participant);
  if (AppState.participants.has(participant.id)) return;
  const tileEl = createVideoTile(participant);
  AppState.participants.set(participant.id, { ...participant, tileEl });
  updateVideoGrid();
  updateParticipantsPanel();
  updateParticipantCount();
  showToast('Participant joined', `${participant.displayName} joined the session.`, 'info');
}

/** SDK event: 'user-removed' — tile'ı animasyonla kaldırır. */
export function handleParticipantLeft(participantId) {
  const p = AppState.participants.get(participantId);
  if (!p) return;
  console.info('[Event] Participant left:', p.displayName);
  p.tileEl.style.transition = 'opacity 300ms, transform 300ms';
  p.tileEl.style.opacity = '0';
  p.tileEl.style.transform = 'scale(0.9)';
  setTimeout(() => p.tileEl.remove(), 320);
  AppState.participants.delete(participantId);
  updateVideoGrid();
  updateParticipantsPanel();
  updateParticipantCount();
  showToast('Participant left', `${p.displayName} left the session.`, 'warning');
}

/** SDK event: 'peer-video-state-change' — tile'ın video-off sınıfını günceller. */
export function handleRemoteVideoStateChanged(participantId, isVideoOn) {
  const p = AppState.participants.get(participantId);
  if (!p) return;
  p.tileEl.classList.toggle('video-tile--video-off', !isVideoOn);
}

/** SDK event: 'user-updated' — mic ikonunu günceller. */
export function handleRemoteAudioStateChanged(participantId, isMuted) {
  const p = AppState.participants.get(participantId);
  if (!p) return;
  const micIcon = p.tileEl.querySelector('.tile-mic-icon');
  if (micIcon) micIcon.classList.toggle('tile-status-icon--muted', isMuted);
}

// ── Binder ────────────────────────────────────────────────────────────────────

/**
 * Zoom SDK event'lerini UI handler'larına bağlar.
 * enterRoom() içinde join() tamamlandıktan sonra çağrılır.
 * Ref: https://developers.zoom.us/docs/video-sdk/web/#event-listeners
 */
export function bindSDKEvents(onSessionClosed) {
  if (!AppState.sdkClient) return;

  // Katılımcı katıldı
  AppState.sdkClient.on('user-added', async (payload) => {
    for (const user of payload) {
      handleParticipantJoined({ id: user.userId, displayName: user.displayName });
      if (user.bVideoOn && AppState.sdkStream) {
        const p = AppState.participants.get(user.userId);
        if (p) {
          const vc = p.tileEl.querySelector('.tile-video-container');
          const userVideo = await AppState.sdkStream.attachVideo(user.userId, 2);
          if (userVideo && vc) vc.appendChild(userVideo);
        }
      }
    }
  });

  // Katılımcı ayrıldı
  AppState.sdkClient.on('user-removed', async (payload) => {
    for (const user of payload) {
      const elements = await AppState.sdkStream?.detachVideo(user.userId);
      if (Array.isArray(elements)) elements.forEach(el => el?.remove?.());
      else elements?.remove?.();
      handleParticipantLeft(user.userId);
    }
  });

  // Mute/unmute gibi kullanıcı güncellemeleri
  AppState.sdkClient.on('user-updated', (payload) => {
    payload.forEach(user => {
      if (user.muted !== undefined) {
        handleRemoteAudioStateChanged(user.userId, user.muted);
      }
    });
  });

  // Uzak kullanıcı kamerayı açtı / kapattı
  AppState.sdkClient.on('peer-video-state-change', async (payload) => {
    handleRemoteVideoStateChanged(payload.userId, payload.action === 'Start');
    if (payload.action === 'Start') {
      const p = AppState.participants.get(payload.userId);
      if (p && AppState.sdkStream) {
        const vc = p.tileEl.querySelector('.tile-video-container');
        const userVideo = await AppState.sdkStream.attachVideo(payload.userId, 2);
        if (userVideo && vc) vc.appendChild(userVideo);
      }
    } else {
      const elements = await AppState.sdkStream?.detachVideo(payload.userId);
      if (Array.isArray(elements)) elements.forEach(el => el?.remove?.());
      else elements?.remove?.();
    }
  });

  // Host oturumu sonlandırdı
  AppState.sdkClient.on('connection-change', (payload) => {
    if (payload.state === 'Closed') {
      showToast('Session ended', 'The host ended the session.', 'warning');
      onSessionClosed?.();
    }
  });
}
