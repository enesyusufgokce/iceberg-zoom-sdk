// ── PARTICIPANTS PANEL ────────────────────────────────────────────────────────
// Sağ kenar çubuğu katılımcı listesini ve sayacı günceller.

import { AppState } from './state.js';
import { DOM } from './dom.js';
import { getInitials } from './helpers.js';

/** Katılımcı panel listesini AppState'ten yeniden oluşturur. */
export function updateParticipantsPanel() {
  DOM.participantsList.innerHTML = '';
  AppState.participants.forEach((p) => {
    const li = document.createElement('li');
    li.classList.add('participant-item');
    li.setAttribute('role', 'listitem');
    const initials = getInitials(p.displayName);
    li.innerHTML = `
      <div class="participant-avatar" aria-hidden="true">${initials}</div>
      <span class="participant-name">${p.displayName}</span>
      ${p.isLocal ? '<span class="participant-you-badge">You</span>' : ''}
    `;
    DOM.participantsList.appendChild(li);
  });
}

/** Room header'daki katılımcı sayısını günceller. */
export function updateParticipantCount() {
  const count = AppState.participants.size;
  DOM.roomParticipantCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}
