// ── APPLICATION STATE ─────────────────────────────────────────────────────────

export const AppState = {
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
