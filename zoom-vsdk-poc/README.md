# Zoom Video SDK — Proof of Concept (POC)

Vanilla JavaScript (ES Modules), HTML5 ve modern Vanilla CSS ile geliştirilmiş, harici framework bağımlılığı olmayan, modüler mimariye sahip Zoom Video SDK entegrasyonu POC projesi.

---

## Proje Yapısı

```
zoom-vsdk-poc/
├── index.html          # Sayfa iskeleti (Lobby ve Room ekranları, kontroller)
├── style.css           # Tasarım sistemi, dark mode teması, video grid ve animasyonlar
├── token-server.js     # Güvenli JWT token üreten Express backend servisi
├── .env                # Zoom SDK kimlik bilgileri (SDK_KEY, SDK_SECRET)
├── package.json        # Backend bağımlılıkları (express, jsonwebtoken, cors, dotenv)
├── README.md           # Proje dokümantasyonu
└── js/                 # Modüler ES modülleri (Vanilla JS)
    ├── main.js         # Uygulama giriş noktası (Bootstrap)
    ├── dom.js          # Tüm DOM element referansları
    ├── state.js        # Uygulama durumu (AppState singleton)
    ├── sdk.js          # Zoom Video SDK adaptör katmanı
    ├── session.js      # Oturum oluşturma, katılma, odaya giriş ve çıkış yaşam döngüsü
    ├── events.js       # Zoom SDK event dinleyicileri (user-added, peer-video, vb.)
    ├── controls.js     # Mikrofon/kamera toggle ve buton durum senkronizasyonu
    ├── tiles.js        # Katılımcı video tile DOM factory
    ├── grid.js         # Dinamik CSS grid sütun yöneticisi
    ├── participants.js # Katılımcı paneli ve sayaç yönetimi
    ├── timer.js        # Oturum süresi sayacı (HH:MM:SS)
    ├── ui.js           # Ekran geçişleri, toast bildirimleri ve loading overlay
    ├── helpers.js      # Yardımcı fonksiyonlar (getInitials)
    └── listeners.js    # DOM event listener bağlantıları ve klavye kısayolları
```

---

## Mimari ve Modül İlişkileri

```
┌─────────────────────────────────────────────────────────────┐
│                    index.html / DOM                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│       js/main.js  ───►  js/listeners.js                     │
│       (Bootstrap)        (DOM Event Dinleyicileri)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│ js/session.js │      │ js/controls.js│      │   js/ui.js    │
│  (Lifecycle)  │      │(Mic / Camera) │      │(Toast, Screen)│
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   js/sdk.js   │      │  js/state.js  │      │   js/dom.js   │
│ (SDK Adaptör) │◄────►│  (AppState)   │◄────►│ (Elementler)  │
└───────┬───────┘      └───────┬───────┘      └───────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐      ┌──────────────────────────────────────┐
│  Zoom SDK CDN │      │ js/tiles.js, js/grid.js,             │
│ (v2.18.0 CDN) │      │ js/participants.js, js/timer.js      │
└───────────────┘      └──────────────────────────────────────┘
```

---

## Modül Sorumlulukları

| Modül | Görevi |
|---|---|
| `js/state.js` | `AppState` nesnesi; oturum durumu, katılımcılar, `sdkClient` ve `sdkStream` referanslarını tutar. |
| `js/dom.js` | Tüm DOM düğümlerini tek bir nesnede toplar; modüller arası tutarlı erişim sağlar. |
| `js/sdk.js` | Zoom Video SDK API'siyle doğrudan konuşan tek katmandır (`initSDK`, `startLocalMedia`, `attachVideo`, `detachVideo`, `leaveSession`). |
| `js/session.js` | Oturum başlatma, oturuma katılma, odaya giriş (`enterRoom`), çıkış ve kaynak temizliği (`cleanupRoom`). |
| `js/events.js` | Zoom Video SDK olaylarını dinler (`user-added`, `user-removed`, `peer-video-state-change`, `user-updated`, `connection-change`). |
| `js/controls.js` | Mikrofon (Mute/Unmute) ve kamera (Start/Stop) açma-kapama işlevleri ve UI durumunu günceller. |
| `js/tiles.js` | Her katılımcı için özel video tile (`.video-tile`) ve Zoom SDK'nın `<video-player>` elementini barındıracak video container DOM'unu üretir. |
| `js/grid.js` | Katılımcı sayısına göre dinamik grid sütun sayısını (1-5) CSS `--cols` değişkeniyle hesaplar. |
| `js/participants.js` | Katılımcı yan panelini ve başlık sayaç bilgisini günceller. |
| `js/timer.js` | Oturum süresini HH:MM:SS formatında canlı günceller. |
| `js/ui.js` | Ekranlar arası geçiş (`lobby` / `room`), dinamik toast bildirimleri ve loading göstergesi. |
| `js/helpers.js` | Katılımcı isimlerinden avatar harfleri üreten yardımcı fonksiyonlar (`getInitials`). |
| `js/listeners.js` | Buton tıklamaları, Enter tuşuyla form gönderme ve klavye kısayollarını (`Alt+M`, `Alt+V`) bağlar. |
| `js/main.js` | DOM hazır olduğunda dinleyicileri bağlayıp uygulamayı başlatan giriş noktası. |

---

## Gereksinimler ve Kurulum

### 1. Ortam Değişkenleri (.env)
Kök dizindeki `.env` dosyasında Zoom Video SDK geliştirici panelinden aldığınız anahtarlar tanımlı olmalıdır:

```env
SDK_KEY=your_zoom_video_sdk_key_here
SDK_SECRET=your_zoom_video_sdk_secret_here
PORT=3001
```

> **Güvenlik Notu:** `SDK_SECRET` asla frontend koduna dahil edilmemelidir. Token üretimi daima `token-server.js` üzerinden backend'de yapılır.

### 2. Bağımlılıkları Yükleme
```bash
npm install
```

---

## Çalıştırma

Uygulamanın çalışması için **iki ayrı servis** gereklidir:
1. **Token Sunucusu (Node.js/Express):** Zoom Video SDK için JWT token sağlar.
2. **Web Sunucusu (Statik HTTP):** ES modüllerini ve web arayüzünü sunar.

### 1. Adım: Token Sunucusunu Başlatın
```bash
node token-server.js
# Çıktı: Token sunucusu: http://localhost:3001
```

### 2. Adım: Web Sunucusunu Başlatın
Tarayıcınızın ES modüllerini CORS kısıtlaması olmadan yükleyebilmesi ve kamera/mikrofon izinleri için yerel bir HTTP sunucusu kullanın:

```bash
# Node.js npx ile:
npx serve .
```

Tarayıcınızda açın:
`http://localhost:8080` (veya `http://localhost:3000`)

---

## Zoom Video SDK Entegrasyon Detayları (v2.x)

Zoom Video SDK Web 2.x sürümü, eski `<video>` elementine stream atama yönteminden farklı olarak modern Canvas/WebGL tabanlı özel `<video-player>` elementlerini kullanır.

### Video Akışı Render Akışı:
1. **İstemci Başlatma:**
   ```javascript
   const client = ZoomVideo.createClient();
   await client.init('en-US', 'Global', { patchJsMedia: true });
   ```
2. **Oturuma Katılma:**
   ```javascript
   await client.join(sessionName, token, userName);
   ```
3. **Kamera Başlatma ve Render:**
   ```javascript
   const stream = client.getMediaStream();
   await stream.startVideo();
   // SDK bir <video-player> custom elementi üretir:
   const userVideo = await stream.attachVideo(userId, 3); // 3 = 720p / HD
   containerElement.appendChild(userVideo);
   ```
4. **Kamera Durdurma:**
   ```javascript
   await stream.stopVideo();
   await stream.detachVideo(userId);
   ```
5. **Oturumdan Ayrılma ve Temizlik:**
   ```javascript
   await client.leave(endForAll);
   ZoomVideo.destroyClient(); // Kaynakları ve bellek sızıntılarını temizler
   ```

---

## Klavye Kısayolları

| Kısayol | Fonksiyon |
|---|---|
| `Alt + M` | Mikrofonu sessize al / aç (Mute/Unmute) |
| `Alt + V` | Kamerayı aç / kapat (Start/Stop Video) |
| `Enter` | Form alanlarındayken (Session Name, Name vb.) formu gönderir |

---

## Video Grid Yerleşim Mantığı

Katılımcı sayısına göre CSS Grid sütun sayısı (`--cols`) otomatik güncellenir:

| Katılımcı Sayısı | Grid Sütun Sayısı |
|---|---|
| 1 | 1 sütun |
| 2 – 4 | 2 sütun |
| 5 – 9 | 3 sütun |
| 10 – 16 | 4 sütun |
| 17+ | 5 sütun |
