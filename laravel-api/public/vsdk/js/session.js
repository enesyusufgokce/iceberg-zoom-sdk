// ── SESSION LIFECYCLE ─────────────────────────────────────────────────────────
// Oturum oluşturma, katılma, odaya girme ve çıkma akışları.

import { AppState } from './state.js';
import { DOM } from './dom.js';
import {
  initSDK, generateSessionToken,
  createSession, joinSession,
  startLocalMedia, stopLocalMedia, leaveSession,
} from './sdk.js';
import { createVideoTile } from './tiles.js';
import { updateVideoGrid } from './grid.js';
import { updateParticipantsPanel, updateParticipantCount } from './participants.js';
import { handleParticipantJoined, bindSDKEvents } from './events.js';
import { switchScreen, showToast, setSDKStatus, showLoading, hideLoading } from './ui.js';
import { updateTimer } from './timer.js';
import { updateControlButtonUI } from './controls.js';

// ── SDK Başlatma ──────────────────────────────────────────────────────────────

export async function onInitSDK() {
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

// ── Create Session ────────────────────────────────────────────────────────────

export async function onCreateSession() {
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

// ── Join Session ──────────────────────────────────────────────────────────────

export async function onJoinSession() {
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

// ── Enter Room ────────────────────────────────────────────────────────────────

export async function enterRoom(sessionId, sessionName, userName) {
  AppState.inSession     = true;
  AppState.sessionId     = sessionId;
  AppState.sessionName   = sessionName;
  AppState.localUserName = userName;
  AppState.isMicMuted    = false;
  AppState.isVideoOff    = false;

  // SDK'dan gerçek numeric userId'yi al
  const currentUser = await AppState.sdkClient.getCurrentUserInfo();
  AppState.localUserId = currentUser.userId;

  DOM.roomSessionName.textContent = sessionName;
  switchScreen('room');

  // Local kullanıcı tile'ını oluştur
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
    AppState.isVideoOff = true;
    localTile.classList.add('video-tile--video-off');
    showToast('Camera denied', 'Could not access camera or microphone. Check browser permissions.', 'warning');
  }
  updateControlButtonUI();

  // Odada zaten video açık olan katılımcıları render et
  const existingUsers = (AppState.sdkClient.getAllUser && AppState.sdkClient.getAllUser()) || [];
  for (const user of existingUsers) {
    if (user.userId === AppState.localUserId) continue;
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

  AppState.sessionStartTime = Date.now();
  AppState.timerInterval = setInterval(updateTimer, 1000);
  showToast('Session started', `You joined "${sessionName}".`, 'success');

  // SDK event'lerini bağla; host kapatırsa cleanupRoom tetiklenir
  bindSDKEvents(cleanupRoom);
}

// ── Leave / Cleanup ───────────────────────────────────────────────────────────

export async function onLeaveSession(endForAll = false) {
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

export function cleanupRoom() {
  clearInterval(AppState.timerInterval);
  AppState.timerInterval = null;

  // Donanımı serbest bırak
  if (AppState.sdkStream) {
    try {
      AppState.sdkStream.stopVideo?.();
      if (AppState.localUserId) AppState.sdkStream.detachVideo?.(AppState.localUserId);
      AppState.sdkStream.stopAudio?.();
    } catch (_) {}
  }

  DOM.videoGrid.innerHTML = '';
  AppState.participants.clear();
  AppState.participantCounter = 0;
  AppState.isMicMuted  = false;
  AppState.isVideoOff  = false;
  AppState.localStream = null;
  AppState.sdkStream   = null;
  AppState.localUserId = null;
  AppState.inSession   = false;

  // SDK'yı temizle — yeniden kullanmak için initSDK() gerekir
  try {
    const zv = window.ZoomVideo || window.WebVideoSDK?.default || window.WebVideoSDK;
    zv?.destroyClient?.();
  } catch (_) {}
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
