// ── DOM REFERENCES ────────────────────────────────────────────────────────────
// Tüm element referansları bir kez sorgulanır ve diğer modüller bu nesneyi import eder.
// <script type="module"> defer edildiği için DOM hazır olduğunda çalışır.

export const DOM = {
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
