// ── VIDEO TILE FACTORY ────────────────────────────────────────────────────────
// Her katılımcı için bir DOM tile oluşturur.
// SDK'nın attachVideo() fonksiyonu video-player elementini .tile-video-container'a ekler.

import { DOM } from './dom.js';
import { getInitials } from './helpers.js';

/**
 * Katılımcı için bir video tile oluşturup grid'e ekler.
 * @param {{ id: number|string, displayName: string, isLocal: boolean }} participant
 * @returns {HTMLElement} Tile elementi
 */
export function createVideoTile(participant) {
  const tile = document.createElement('article');
  tile.classList.add('video-tile');
  tile.setAttribute('role', 'listitem');
  tile.setAttribute('aria-label', `${participant.displayName}'s video`);
  tile.dataset.participantId = participant.id;

  if (participant.isLocal) tile.classList.add('video-tile--local');

  const initials = getInitials(participant.displayName);

  tile.innerHTML = `
    <video-player-container class="tile-video-container" id="vpc-${participant.id}"></video-player-container>

    <div class="video-tile__avatar tile-video-off" aria-hidden="true">
      <div class="avatar-ring">${initials}</div>
      <span class="avatar-name">${participant.displayName}</span>
    </div>

    <div class="video-tile__overlay" aria-hidden="true">
      <div class="tile-name-row">
        <span class="tile-name">${participant.displayName}</span>
        <div class="tile-status-icons">
          <div class="tile-status-icon tile-mic-icon" title="Microphone">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    ${participant.isLocal ? '<span class="tile-local-badge">You</span>' : ''}
  `;

  DOM.videoGrid.appendChild(tile);
  return tile;
}
