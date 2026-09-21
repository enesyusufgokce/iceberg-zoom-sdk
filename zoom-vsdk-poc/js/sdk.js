// ── SDK ADAPTER LAYER ─────────────────────────────────────────────────────────
// Zoom Video SDK ile tek temas noktası.
// Gerçek SDK çağrıları burada. Detaylı entegrasyon bilgisi için README'ye bak.
// Ref: https://developers.zoom.us/docs/video-sdk/web/

import { AppState } from './state.js';

export function getZoomVideo() {
  const zv = window.ZoomVideo || window.WebVideoSDK?.default || window.WebVideoSDK;
  if (!zv) {
    throw new Error('Zoom Video SDK yüklenemedi. Lütfen SDK script dosyasının yüklendiğinden emin olun.');
  }
  if (!window.ZoomVideo) window.ZoomVideo = zv;
  return zv;
}

export async function initSDK() {
  console.info('[SDK] initSDK');
  const ZoomVideo = getZoomVideo();
  const client = ZoomVideo.createClient();
  await client.init('en-US', 'Global', { patchJsMedia: true });
  AppState.sdkClient = client;
  console.info('[SDK] initialized.');
}

export async function generateSessionToken(sessionName, role = 1) {
  console.info('[SDK] generateSessionToken:', sessionName, 'role:', role);
  try {
    const res = await fetch('http://localhost:8080/api/zoom/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionName, role }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Token alınamadı: ' + res.statusText);
    }
    const { token } = await res.json();
    return token;
  } catch (err) {
    if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('Token sunucusuna bağlanılamadı (http://localhost:8080). Lütfen go-backend\'in çalıştığından emin olun.');
    }
    throw err;
  }
}

export async function createSession({ sessionName, userName, token }) {
  console.info('[SDK] createSession:', sessionName, 'as', userName);
  await AppState.sdkClient.join(sessionName, token, userName);
  const info = AppState.sdkClient.getSessionInfo();
  return { sessionId: info.sessionId || sessionName };
}

export async function joinSession({ sessionId, userName }) {
  console.info('[SDK] joinSession:', sessionId, 'as', userName);
  const token = await generateSessionToken(sessionId, 0); // Katılımcı rolü: 0
  await AppState.sdkClient.join(sessionId, token, userName);
}

/**
 * Kamera + mikrofonu başlatır, video-player elementini container'a ekler.
 * @param {HTMLElement} container — tile içindeki .tile-video-container div'i
 * @returns {Promise<MediaStream|null>}
 */
export async function startLocalMedia(container) {
  console.info('[SDK] startLocalMedia');
  try {
    const stream = AppState.sdkClient.getMediaStream();
    AppState.sdkStream = stream;

    // Mikrofonu başlat (hata verirse videoyu engellemesin)
    try {
      await stream.startAudio();
    } catch (audioErr) {
      console.warn('[SDK] startAudio failed (ignoring to allow video):', audioErr.message || audioErr);
    }

    // Kamerayı başlat
    await stream.startVideo();

    // 2 = VideoQuality.Video_360P (Tüm tarayıcılarda varsayılan çalışan standart çözünürlük)
    const userVideo = await stream.attachVideo(AppState.localUserId, 2);
    if (userVideo && container) {
      container.appendChild(userVideo);
    }
    return stream;
  } catch (err) {
    console.error('[SDK] Could not start camera/video:', err);
    return null;
  }
}

export async function stopLocalMedia() {
  console.info('[SDK] stopLocalMedia');
  if (!AppState.sdkStream) return;
  try {
    await AppState.sdkStream.stopVideo();
    const elements = await AppState.sdkStream.detachVideo(AppState.localUserId);
    if (Array.isArray(elements)) {
      elements.forEach(el => el?.remove?.());
    } else {
      elements?.remove?.();
    }
    await AppState.sdkStream.stopAudio();
  } catch (err) {
    console.warn('[SDK] stopLocalMedia error:', err.message);
  }
}

export async function setMicMute(mute) {
  console.info('[SDK] setMicMute:', mute);
  if (!AppState.sdkStream) return;
  mute
    ? await AppState.sdkStream.muteAudio()
    : await AppState.sdkStream.unmuteAudio();
}

/**
 * Kamerayı açar/kapatır.
 * Açarken attachVideo() ile video-player oluşturur, kapatırken detachVideo() kaldırır.
 * @param {boolean} enable
 */
export async function setVideoEnabled(enable) {
  console.info('[SDK] setVideoEnabled:', enable);
  if (!AppState.sdkStream) return;
  if (enable) {
    await AppState.sdkStream.startVideo();
    const localP = AppState.participants.get(AppState.localUserId);
    if (localP) {
      const container = localP.tileEl.querySelector('.tile-video-container');
      const userVideo = await AppState.sdkStream.attachVideo(AppState.localUserId, 2);
      if (userVideo && container) {
        container.appendChild(userVideo);
      }
    }
  } else {
    await AppState.sdkStream.stopVideo();
    const elements = await AppState.sdkStream.detachVideo(AppState.localUserId);
    if (Array.isArray(elements)) {
      elements.forEach(el => el?.remove?.());
    } else {
      elements?.remove?.();
    }
  }
}

export async function leaveSession(end = false) {
  console.info('[SDK] leaveSession (end for all:', end, ')');
  await AppState.sdkClient.leave(end);
}
