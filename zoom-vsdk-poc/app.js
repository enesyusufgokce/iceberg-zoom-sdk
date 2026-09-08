'use strict';

// ── A: SDK ADAPTER LAYER ──────────────────────────────────────────────────────
// Zoom Video SDK gerçek entegrasyonu.
// Ref: https://developers.zoom.us/docs/video-sdk/web/

async function initSDK(config = {}) {
  console.info('[SDK] initSDK');
  const client = ZoomVideo.createClient();
  await client.init('en-US', 'Global', { patchJsMedia: true });
  AppState.sdkClient = client;
  console.info('[SDK] initialized.');
}

async function generateSessionToken(sessionName) {
  console.info('[SDK] generateSessionToken:', sessionName);
  const res = await fetch('http://localhost:3001/api/zoom/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionName, role: 1 }),
  });
  if (!res.ok) throw new Error('Token alınamadı: ' + res.statusText);
  const { token } = await res.json();
  return token;
}

async function createSession({ sessionName, userName, token }) {
  console.info('[SDK] createSession:', sessionName, 'as', userName);
  await AppState.sdkClient.join(sessionName, token, userName);
  const info = AppState.sdkClient.getSessionInfo();
  return { sessionId: info.sessionId || sessionName };
}

async function joinSession({ sessionId, userName }) {
  console.info('[SDK] joinSession:', sessionId, 'as', userName);
  const token = await generateSessionToken(sessionId);
  await AppState.sdkClient.join(sessionId, token, userName);
}

/**
 * Kamera + mikrofonu başlatır. attachVideo() ile container'a video-player elementini ekler.
 * @param {HTMLElement} container — tile'daki video-player-container div'i
 */
async function startLocalMedia(container) {
  console.info('[SDK] startLocalMedia');
  try {
    const stream = AppState.sdkClient.getMediaStream();
    AppState.sdkStream = stream;

    // Ses başlat
    await stream.startAudio();

    // Video başlat + render et
    await stream.startVideo();
    const userVideo = await stream.attachVideo(AppState.localUserId, 3);
    container.appendChild(userVideo);

    return stream;
  } catch (err) {
    console.warn('[SDK] Could not start media:', err.message);
    return null;
  }
}

async function stopLocalMedia() {
  console.info('[SDK] stopLocalMedia');
  if (!AppState.sdkStream) return;
  try {
    await AppState.sdkStream.stopVideo();
    AppState.sdkStream.detachVideo(AppState.localUserId);
    await AppState.sdkStream.stopAudio();
  } catch (err) {
    console.warn('[SDK] stopLocalMedia error:', err.message);
  }
}

async function setMicMute(mute) {
  console.info('[SDK] setMicMute:', mute);
  if (!AppState.sdkStream) return;
  mute
    ? await AppState.sdkStream.muteAudio()
    : await AppState.sdkStream.unmuteAudio();
}

/**
 * Kamerayı açar/kapatır. Açarken attachVideo(), kapatırken detachVideo() kullanır.
 */
async function setVideoEnabled(enable) {
  console.info('[SDK] setVideoEnabled:', enable);
  if (!AppState.sdkStream) return;

  if (enable) {
    await AppState.sdkStream.startVideo();
    const localP = AppState.participants.get(AppState.localUserId);
    if (localP) {
      const container = localP.tileEl.querySelector('.tile-video-container');
      const userVideo = await AppState.sdkStream.attachVideo(AppState.localUserId, 3);
      container.appendChild(userVideo);
    }
  } else {
    await AppState.sdkStream.stopVideo();
    AppState.sdkStream.detachVideo(AppState.localUserId);
  }
}

async function leaveSession(end = false) {
  console.info('[SDK] leaveSession (end for all:', end, ')');
  await AppState.sdkClient.leave(end);
}


// ── B: APPLICATION STATE ──────────────────────────────────────────────────────

const AppState = {
  sdkInitialized: false,
  inSession: false,
  sessionId: null,
  sessionName: null,
  localUserName: null,
  localUserId: null,   // SDK'dan gelen gerçek numeric userId
  localStream: null,   // sdkStream referansı (compat)
  sdkClient: null,     // ZoomVideo client instance
  sdkStream: null,     // MediaStream (getMediaStream() sonucu)
  isMicMuted: false,
  isVideoOff: false,
  participants: new Map(),
  participantCounter: 0,
  sessionStartTime: null,
  timerInterval: null,
};


// ── C: DOM REFERENCES ─────────────────────────────────────────────────────────

const DOM = {
  // Screens
  lobbyScreen: document.getElementById('lobby-screen'),
  roomScreen:  document.getElementById('room-screen'),

  // Lobby
  sdkStatusBanner: document.getElementById('sdk-status-banner'),
  sdkStatusText:   document.getElementById('sdk-status-text'),
  btnInitSDK:      document.getElementById('btn-init-sdk'),

  // Tabs
  tabCreate:   document.getElementById('tab-create'),
  tabJoin:     document.getElementById('tab-join'),
  panelCreate: document.getElementById('panel-create'),
  panelJoin:   document.getElementById('panel-join'),

  // Create form
  createSessionName: document.getElementById('create-session-name'),
  createUserName:    document.getElementById('create-user-name'),
  createSdkKey:      document.getElementById('create-sdk-key'),
  createSdkSecret:   document.getElementById('create-sdk-secret'),
  btnCreateSession:  document.getElementById('btn-create-session'),

  // Join form
  joinSessionId:  document.getElementById('join-session-id'),
  joinUserName:   document.getElementById('join-user-name'),
  btnJoinSession: document.getElementById('btn-join-session'),

  // Room header
  roomSessionName:      document.getElementById('room-session-name'),
  roomParticipantCount: document.getElementById('room-participant-count'),
  roomTimer:            document.getElementById('room-timer'),
  btnLeave:             document.getElementById('btn-leave'),

  // Video grid
  videoGrid: document.getElementById('video-grid'),

  // Control bar
  btnToggleMic:    document.getElementById('btn-toggle-mic'),
  btnToggleVideo:  document.getElementById('btn-toggle-video'),
  btnEndSession:   document.getElementById('btn-end-session'),
  btnParticipants: document.getElementById('btn-participants'),

  // Participants panel
  participantsPanel:    document.getElementById('participants-panel'),
  btnCloseParticipants: document.getElementById('btn-close-participants'),
  participantsList:     document.getElementById('participants-list'),

  // Utility
  toastContainer: document.getElementById('toast-container'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingMessage: document.getElementById('loading-message'),
};


// ── D: SDK EVENT HANDLERS ─────────────────────────────────────────────────────
// UI güncelleme fonksiyonları — bindSDKEvents() içinde SDK event'lerine bağlanır.

function handleParticipantJoined(participant) {
  console.info('[Event] Participant joined:', participant);
  if (AppState.participants.has(participant.id)) return;
  const tileEl = createVideoTile(participant);
  AppState.participants.set(participant.id, { ...participant, tileEl });
  updateVideoGrid();
  updateParticipantsPanel();
  updateParticipantCount();
  showToast('Participant joined', `${participant.displayName} joined the session.`, 'info');
}

function handleParticipantLeft(participantId) {
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

function handleRemoteVideoStateChanged(participantId, isVideoOn) {
  const p = AppState.participants.get(participantId);
  if (!p) return;
  p.tileEl.classList.toggle('video-tile--video-off', !isVideoOn);
}

function handleRemoteAudioStateChanged(participantId, isMuted) {
  const p = AppState.participants.get(participantId);
  if (!p) return;
  const micIcon = p.tileEl.querySelector('.tile-mic-icon');
  if (micIcon) micIcon.classList.toggle('tile-status-icon--muted', isMuted);
}


// ── E: VIDEO TILE FACTORY ─────────────────────────────────────────────────────
// Her tile'da SDK'nın attachVideo() ile video-player ekleyeceği bir container var.

function createVideoTile(participant) {
  const tile = document.createElement('article');
  tile.classList.add('video-tile');
  tile.setAttribute('role', 'listitem');
  tile.setAttribute('aria-label', `${participant.displayName}'s video`);
  tile.dataset.participantId = participant.id;

  if (participant.isLocal) tile.classList.add('video-tile--local');

  const initials = getInitials(participant.displayName);

  tile.innerHTML = `
    <!-- SDK'nın attachVideo() sonucunu (video-player elementi) buraya ekler -->
    <div class="tile-video-container" id="vpc-${participant.id}"></div>

    <!-- Video kapalıyken avatar gösterilir -->
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


// ── F: VIDEO GRID LAYOUT ──────────────────────────────────────────────────────

function updateVideoGrid() {
  const count = AppState.participants.size;
  let cols = 1;
  if      (count <= 1)  cols = 1;
  else if (count <= 4)  cols = 2;
  else if (count <= 9)  cols = 3;
  else if (count <= 16) cols = 4;
  else                  cols = 5;
  DOM.videoGrid.style.setProperty('--cols', cols);
}


// ── G: PARTICIPANTS PANEL ─────────────────────────────────────────────────────

function updateParticipantsPanel() {
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

function updateParticipantCount() {
  const count = AppState.participants.size;
  DOM.roomParticipantCount.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}


// ── H: SESSION LIFECYCLE ──────────────────────────────────────────────────────

async function onInitSDK() {
  if (AppState.sdkInitialized) {
    showToast('Already initialized', 'The SDK is already ready.', 'info');
    return;
  }
  setSDKStatus('initializing', 'Initializing SDK…');
  showLoading('Loading Video SDK…');
  DOM.btnInitSDK.disabled = true;
  try {
    await initSDK();
    AppState.sdkInitialized = true;
    setSDKStatus('ready', 'SDK Ready');
    showToast('SDK Ready', 'Video SDK initialized successfully.', 'success');
  } catch (err) {
    setSDKStatus('error', 'SDK Init Failed');
    showToast('SDK Error', err.message || 'Could not initialize the SDK.', 'error');
    DOM.btnInitSDK.disabled = false;
  } finally {
    hideLoading();
  }
}

async function onCreateSession() {
  const sessionName = DOM.createSessionName.value.trim();
  const userName    = DOM.createUserName.value.trim();

  if (!sessionName) { showToast('Missing field', 'Please enter a session name.', 'warning'); return; }
  if (!userName)    { showToast('Missing field', 'Please enter your display name.', 'warning'); return; }

  showLoading('Creating session…');
  DOM.btnCreateSession.disabled = true;

  try {
    if (!AppState.sdkInitialized) {
      setSDKStatus('initializing', 'Auto-initializing SDK…');
      await initSDK();
      AppState.sdkInitialized = true;
      setSDKStatus('ready', 'SDK Ready');
    }
    const token = await generateSessionToken(sessionName);
    const { sessionId } = await createSession({ sessionName, userName, token });
    await enterRoom(sessionId, sessionName, userName);
  } catch (err) {
    console.error('[App] createSession error:', err);
    showToast('Session Error', err.message || 'Failed to create session.', 'error');
  } finally {
    hideLoading();
    DOM.btnCreateSession.disabled = false;
  }
}

async function onJoinSession() {
  const sessionId = DOM.joinSessionId.value.trim();
  const userName  = DOM.joinUserName.value.trim();

  if (!sessionId) { showToast('Missing field', 'Please enter a session ID.', 'warning'); return; }
  if (!userName)  { showToast('Missing field', 'Please enter your display name.', 'warning'); return; }

  showLoading('Joining session…');
  DOM.btnJoinSession.disabled = true;

  try {
    if (!AppState.sdkInitialized) {
      setSDKStatus('initializing', 'Auto-initializing SDK…');
      await initSDK();
      AppState.sdkInitialized = true;
      setSDKStatus('ready', 'SDK Ready');
    }
    await joinSession({ sessionId, userName });
    await enterRoom(sessionId, sessionId, userName);
  } catch (err) {
    console.error('[App] joinSession error:', err);
    showToast('Join Error', err.message || 'Failed to join session.', 'error');
  } finally {
    hideLoading();
    DOM.btnJoinSession.disabled = false;
  }
}

async function enterRoom(sessionId, sessionName, userName) {
  AppState.inSession    = true;
  AppState.sessionId    = sessionId;
  AppState.sessionName  = sessionName;
  AppState.localUserName = userName;
  AppState.isMicMuted   = false;
  AppState.isVideoOff   = false;

  // SDK'dan gerçek userId'yi al (join() sonrasında erişilebilir)
  const currentUser = AppState.sdkClient.getCurrentUserInfo();
  AppState.localUserId = currentUser.userId;

  DOM.roomSessionName.textContent = sessionName;
  switchScreen('room');

  // Local kullanıcı tile'ı oluştur
  const localTile = createVideoTile({
    id: AppState.localUserId,
    displayName: userName,
    isLocal: true,
  });
  AppState.participants.set(AppState.localUserId, {
    id: AppState.localUserId,
    displayName: userName,
    isLocal: true,
    tileEl: localTile,
  });
  updateVideoGrid();
  updateParticipantsPanel();
  updateParticipantCount();

  // Kamera + mikrofonu başlat
  const container = localTile.querySelector('.tile-video-container');
  AppState.localStream = await startLocalMedia(container);

  if (!AppState.localStream) {
    localTile.classList.add('video-tile--video-off');
    showToast('Camera denied', 'Could not access camera or microphone. Check browser permissions.', 'warning');
  }

  // Odada zaten video açık olan katılımcıları render et
  const existingUsers = AppState.sdkClient.getAllUser();
  for (const user of existingUsers) {
    if (user.userId === AppState.localUserId) continue;
    handleParticipantJoined({ id: user.userId, displayName: user.displayName });
    if (user.bVideoOn) {
      const p = AppState.participants.get(user.userId);
      if (p) {
        const vc = p.tileEl.querySelector('.tile-video-container');
        const userVideo = await AppState.sdkStream.attachVideo(user.userId, 3);
        vc.appendChild(userVideo);
      }
    }
  }

  AppState.sessionStartTime = Date.now();
  AppState.timerInterval = setInterval(updateTimer, 1000);
  showToast('Session started', `You joined "${sessionName}".`, 'success');

  // SDK event'lerini bağla
  bindSDKEvents();
}

/**
 * Gerçek Zoom SDK event'lerini UI handler'larına bağlar.
 * Ref: https://developers.zoom.us/docs/video-sdk/web/#event-listeners
 */
function bindSDKEvents() {
  if (!AppState.sdkClient) return;

  // Katılımcı katıldı — tile oluştur, varsa videoyu render et
  AppState.sdkClient.on('user-added', async (payload) => {
    for (const user of payload) {
      handleParticipantJoined({ id: user.userId, displayName: user.displayName });
      if (user.bVideoOn) {
        const p = AppState.participants.get(user.userId);
        if (p) {
          const vc = p.tileEl.querySelector('.tile-video-container');
          const userVideo = await AppState.sdkStream.attachVideo(user.userId, 3);
          vc.appendChild(userVideo);
        }
      }
    }
  });

  // Katılımcı ayrıldı — önce video'yu detach et, sonra tile'ı kaldır
  AppState.sdkClient.on('user-removed', (payload) => {
    payload.forEach(user => {
      AppState.sdkStream?.detachVideo(user.userId);
      handleParticipantLeft(user.userId);
    });
  });

  // Katılımcı güncellendi (mute/unmute, video durumu vb.)
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
      if (p) {
        const vc = p.tileEl.querySelector('.tile-video-container');
        const userVideo = await AppState.sdkStream.attachVideo(payload.userId, 3);
        vc.appendChild(userVideo);
      }
    } else {
      AppState.sdkStream?.detachVideo(payload.userId);
    }
  });

  // Host oturumu sonlandırdı
  AppState.sdkClient.on('connection-change', (payload) => {
    if (payload.state === 'Closed') {
      showToast('Session ended', 'The host ended the session.', 'warning');
      cleanupRoom();
    }
  });
}

async function onLeaveSession(endForAll = false) {
  if (!AppState.inSession) return;
  showLoading(endForAll ? 'Ending session…' : 'Leaving session…');
  try {
    await stopLocalMedia();
    await leaveSession(endForAll);
  } catch (err) {
    console.warn('[App] Error during leave:', err);
  } finally {
    cleanupRoom();
    hideLoading();
  }
}

function cleanupRoom() {
  clearInterval(AppState.timerInterval);
  AppState.timerInterval = null;
  DOM.videoGrid.innerHTML = '';
  AppState.participants.clear();
  AppState.participantCounter = 0;
  AppState.isMicMuted  = false;
  AppState.isVideoOff  = false;
  AppState.localStream = null;
  AppState.sdkStream   = null;
  AppState.localUserId = null;
  AppState.inSession   = false;

  // SDK'yı temizle (yeniden init gerektirir)
  try { ZoomVideo.destroyClient(); } catch (_) {}
  AppState.sdkClient = null;
  AppState.sdkInitialized = false;
  setSDKStatus('idle', 'SDK Not Initialized');

  updateControlButtonUI();
  updateParticipantsPanel();
  DOM.roomTimer.textContent = '00:00:00';
  DOM.participantsPanel.classList.remove('open');
  switchScreen('lobby');
  showToast('Session ended', 'You have left the session.', 'info');
}


// ── I: MEDIA CONTROLS ────────────────────────────────────────────────────────

async function onToggleMic() {
  AppState.isMicMuted = !AppState.isMicMuted;
  await setMicMute(AppState.isMicMuted);
  updateControlButtonUI();
  updateLocalTileStatus();
}

async function onToggleVideo() {
  AppState.isVideoOff = !AppState.isVideoOff;
  await setVideoEnabled(!AppState.isVideoOff);
  const localP = AppState.participants.get(AppState.localUserId);
  if (localP) localP.tileEl.classList.toggle('video-tile--video-off', AppState.isVideoOff);
  updateControlButtonUI();
}

function updateControlButtonUI() {
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

function updateLocalTileStatus() {
  const localP = AppState.participants.get(AppState.localUserId);
  if (!localP) return;
  const micIcon = localP.tileEl.querySelector('.tile-mic-icon');
  if (micIcon) micIcon.classList.toggle('tile-status-icon--muted', AppState.isMicMuted);
}


// ── J: SESSION TIMER ──────────────────────────────────────────────────────────

function updateTimer() {
  if (!AppState.sessionStartTime) return;
  const elapsed = Math.floor((Date.now() - AppState.sessionStartTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  DOM.roomTimer.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}


// ── K: UI UTILITIES ───────────────────────────────────────────────────────────

function switchScreen(screen) {
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

function showToast(title, message, type = 'info', duration = 4000) {
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

function setSDKStatus(state, text) {
  DOM.sdkStatusBanner.className = `status-banner status-banner--${state}`;
  DOM.sdkStatusText.textContent = text;
}

function showLoading(message = 'Loading…') {
  DOM.loadingMessage.textContent = message;
  DOM.loadingOverlay.classList.add('visible');
  DOM.loadingOverlay.removeAttribute('aria-hidden');
}

function hideLoading() {
  DOM.loadingOverlay.classList.remove('visible');
  DOM.loadingOverlay.setAttribute('aria-hidden', 'true');
}

function switchTab(tab) {
  const isCreate = tab === 'create';
  DOM.tabCreate.classList.toggle('active', isCreate);
  DOM.tabJoin.classList.toggle('active', !isCreate);
  DOM.tabCreate.setAttribute('aria-selected', isCreate);
  DOM.tabJoin.setAttribute('aria-selected', !isCreate);
  DOM.panelCreate.classList.toggle('active', isCreate);
  DOM.panelJoin.classList.toggle('active', !isCreate);
}


// ── L: HELPERS ────────────────────────────────────────────────────────────────

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}


// ── N: EVENT LISTENERS ────────────────────────────────────────────────────────

function initEventListeners() {
  DOM.btnInitSDK.addEventListener('click', onInitSDK);
  DOM.btnCreateSession.addEventListener('click', onCreateSession);
  DOM.btnJoinSession.addEventListener('click', onJoinSession);

  DOM.tabCreate.addEventListener('click', () => switchTab('create'));
  DOM.tabJoin.addEventListener('click',   () => switchTab('join'));

  [DOM.createSessionName, DOM.createUserName, DOM.createSdkKey, DOM.createSdkSecret]
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') onCreateSession(); }));

  [DOM.joinSessionId, DOM.joinUserName]
    .forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') onJoinSession(); }));

  DOM.btnToggleMic.addEventListener('click', onToggleMic);
  DOM.btnToggleVideo.addEventListener('click', onToggleVideo);
  DOM.btnLeave.addEventListener('click', () => onLeaveSession(false));
  DOM.btnEndSession.addEventListener('click', () => onLeaveSession(true));

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

  document.addEventListener('keydown', (e) => {
    if (!AppState.inSession) return;
    if (e.altKey && e.key === 'm') { e.preventDefault(); onToggleMic(); }
    if (e.altKey && e.key === 'v') { e.preventDefault(); onToggleVideo(); }
  });
}


// ── O: BOOTSTRAP ─────────────────────────────────────────────────────────────

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
