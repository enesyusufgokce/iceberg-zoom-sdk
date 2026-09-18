// ── EVENT LISTENERS ───────────────────────────────────────────────────────────
// DOM event'lerini handler fonksiyonlarına bağlar. Yalnızca main.js tarafından çağrılır.

import { DOM } from './dom.js';
import { AppState } from './state.js';
import { onInitSDK, onCreateSession, onJoinSession, onLeaveSession } from './session.js';
import { onToggleMic, onToggleVideo } from './controls.js';
import { switchTab } from './ui.js';

export function initEventListeners() {
  // Lobby
  DOM.btnInitSDK.addEventListener('click', onInitSDK);
  DOM.btnCreateSession.addEventListener('click', onCreateSession);
  DOM.btnJoinSession.addEventListener('click', onJoinSession);

  // Tabs
  DOM.tabCreate.addEventListener('click', () => switchTab('create'));
  DOM.tabJoin.addEventListener('click',   () => switchTab('join'));

  // Enter tuşuyla form gönderme
  [DOM.createSessionName, DOM.createUserName, DOM.createSdkKey, DOM.createSdkSecret]
    .filter(Boolean)
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') onCreateSession(); }));
  [DOM.joinSessionId, DOM.joinUserName]
    .filter(Boolean)
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') onJoinSession(); }));

  // Room controls
  DOM.btnToggleMic.addEventListener('click', onToggleMic);
  DOM.btnToggleVideo.addEventListener('click', onToggleVideo);
  DOM.btnLeave.addEventListener('click', () => onLeaveSession(false));
  DOM.btnEndSession.addEventListener('click', () => onLeaveSession(true));

  // Participants panel
  DOM.btnParticipants.addEventListener('click', () => {
    const isOpen = DOM.participantsPanel.classList.toggle('open');
    DOM.participantsPanel.setAttribute('aria-hidden', !isOpen);
    DOM.btnParticipants.setAttribute('aria-expanded', isOpen);
  });
  DOM.btnCloseParticipants.addEventListener('click', () => {
    DOM.participantsPanel.classList.remove('open');
    DOM.participantsPanel.setAttribute('aria-hidden', 'true');
    DOM.btnParticipants.setAttribute('aria-expanded', 'false');
  });

  // Klavye kısayolları: Alt+M mic | Alt+V video
  document.addEventListener('keydown', (e) => {
    if (!AppState.inSession) return;
    if (e.altKey && e.key === 'm') { e.preventDefault(); onToggleMic(); }
    if (e.altKey && e.key === 'v') { e.preventDefault(); onToggleVideo(); }
  });
}
