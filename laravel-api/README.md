# Zoom SDK Laravel API — POC Backend

Bu proje, **Iceberg Lifecycle CRM** için Zoom SDK entegrasyonunun Laravel backend POC'udur.
Amaç, Zoom SDK auth akışının (Meeting SDK JWT + OAuth) uçtan uca çalıştığını kanıtlamaktır.

## Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Iceberg CRM Frontend                           │
│  zoom-msdk-poc/index.html  ──────── zoom-vsdk-poc/index.html        │
└────────────┬───────────────────────────────────┬────────────────────┘
             │ POST /api/zoom/meeting-auth        │ (future: video token)
             ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     laravel-api/ (this project)                     │
│                                                                     │
│  MeetingAuthController ── ZoomJwtService (firebase/php-jwt)         │
│  OAuthController       ── ZoomOAuthService (Http facade)            │
│  WebhookController     ── ProcessZoomWebhookEvent (Queue)           │
│  ZoomMeetingService    ── Zoom REST API v2                          │
│  ZoomTokenService      ── ZAK / OBF tokens                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │  Neon PostgreSQL (pgsql) │
                    │  zoom_oauth_tokens       │
                    │  zoom_meetings           │
                    │  zoom_video_sessions     │
                    │  zoom_webhook_events     │
                    └──────────────────────────┘
```

---

## Kurulum

### 1. Bağımlılıkları yükle

```bash
cd laravel-api
composer install
```

### 2. Ortam dosyasını hazırla

```bash
cp .env.example .env
php artisan key:generate
```

> `APP_KEY` değeri Laravel'in `encrypted` cast ile token şifrelemesinde kullanılır.
> Değiştirilirse veritabanındaki mevcut tokenlar okunamaz hale gelir.

### 3. `.env` dosyasını doldur

Aşağıdaki bölümleri sırayla doldurun (detaylar için ilgili Zoom adımlarına bakın):

```dotenv
# PostgreSQL — Neon
DB_CONNECTION=pgsql
DB_HOST=<neon-host>.neon.tech
DB_PORT=5432
DB_DATABASE=<veritabani-adi>
DB_USERNAME=<kullanici-adi>
DB_PASSWORD=<sifre>

# Meeting SDK
ZOOM_SDK_CLIENT_ID=<sdk-client-id>
ZOOM_SDK_CLIENT_SECRET=<sdk-client-secret>

# OAuth
ZOOM_OAUTH_CLIENT_ID=<oauth-client-id>
ZOOM_OAUTH_CLIENT_SECRET=<oauth-client-secret>
ZOOM_OAUTH_REDIRECT_URI=http://localhost:8000/zoom/oauth/callback

# Webhook
ZOOM_WEBHOOK_SECRET_TOKEN=<webhook-secret-token>
```

### 4. Veritabanı

Tablolar Neon üzerinde zaten oluşturulmuş durumda (migration gerekmez):

- `zoom_oauth_tokens`
- `zoom_meetings`
- `zoom_video_sessions`
- `zoom_webhook_events`

Bağlantıyı doğrulamak için:

```bash
php artisan db:show
```

### 5. Sunucuyu başlat

```bash
php artisan serve
# → http://localhost:8000
```

---

## Zoom Marketplace App Oluşturma

### Adım 1 — General App oluştur

1. [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop** → **Build App**
2. **General App** seç → isme ver → **Create**

### Adım 2 — Meeting SDK özelliğini ekle

1. App sayfasında **Feature** sekmesine git
2. **Meeting SDK** bölümünü etkinleştir
3. **Client ID** ve **Client Secret** değerlerini al → `.env`'e yaz:
   ```
   ZOOM_SDK_CLIENT_ID=...
   ZOOM_SDK_CLIENT_SECRET=...
   ```

### Adım 3 — OAuth özelliğini ekle

1. **Feature** → **OAuth** bölümünü etkinleştir
2. **Redirect URL** ekle: `http://localhost:8000/zoom/oauth/callback`
3. **Client ID** ve **Client Secret** değerlerini al → `.env`'e yaz:
   ```
   ZOOM_OAUTH_CLIENT_ID=...
   ZOOM_OAUTH_CLIENT_SECRET=...
   ```

### Adım 4 — Gerekli OAuth Scope'larını ekle

**Scopes** sekmesinde şu scope'ları ekle:

| Scope | Gerekçe |
|---|---|
| `user:read:zak` | ZAK (Zoom Access Key) almak için |
| `user:read:token` | OBF (On-Behalf-Of) token almak için |
| `meeting:write:meeting` | Meeting oluşturmak için |
| `meeting:read:meeting` | Meeting bilgisi çekmek için |

### Adım 5 — Webhook endpoint'ini ekle

1. **Feature** → **Event Subscriptions** → **+ Add Event Subscription**
2. **Event notification endpoint URL**: `https://<your-domain>/api/zoom/webhook`
   - Yerel geliştirme için [ngrok](https://ngrok.com/) kullanabilirsiniz:
     ```bash
     ngrok http 8000
     # → https://xxxx.ngrok.io/api/zoom/webhook
     ```
3. **Secret Token** değerini al → `.env`'e yaz:
   ```
   ZOOM_WEBHOOK_SECRET_TOKEN=...
   ```
4. İstediğiniz event'leri ekleyin (ör. `meeting.started`, `meeting.ended`, `recording.completed`)
5. **Validate** butonuna tıkla — Laravel backend URL validation challenge'ını otomatik yanıtlar.

---

## API Referansı

### `POST /api/zoom/meeting-auth`

Meeting SDK JWT imzası üretir. Frontend, `ZoomMtg.join()` çağrısından önce bunu çağırır.

**Request:**
```json
{
  "meeting_number": "123456789",
  "role": 0
}
```

`role`: `0` = katılımcı, `1` = host

**Response (200):**
```json
{
  "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sdkKey": "your-sdk-client-id"
}
```

> Client Secret **asla** response'a dahil edilmez.

---

### `GET /zoom/oauth/redirect`

Kullanıcıyı Zoom consent ekranına yönlendirir.

**Query params (POC):**
```
?user_id=1
```

---

### `GET /zoom/oauth/callback`

Zoom'dan dönen code'u token'a çevirir ve veritabanına kaydeder.

---

### `POST /api/zoom/webhook`

Zoom webhook olaylarını alır. CSRF korumasından muaftır — güvenlik HMAC imzasıyla sağlanır.

---

## Testleri Çalıştırma

```bash
cd laravel-api

# Sadece Zoom JWT testleri
php artisan test --filter=ZoomJwtServiceTest

# Tüm testler
php artisan test
```

### Test coverage özeti

`ZoomJwtServiceTest` şunları doğrular:
- `exp - iat` değerinin `[1800, 172800]` aralığında olduğu
- Configured TTL değerinin kullanıldığı
- `sdkKey`, `appKey`, `mn`, `role`, `tokenExp` alanlarının doğru set edildiği
- `iat`'ın 30 saniye geride olduğu (clock skew koruması)
- HS256 algoritmasının kullanıldığı
- Geçersiz role, TTL ve boş credential'ların exception fırlattığı
- 1800, 7200 ve 172800 saniyelik tüm geçerli TTL değerlerinin çalıştığı

---

## Güvenlik Notları

| Kural | Uygulama |
|---|---|
| SDK/OAuth Client Secret'ları sadece backend'de | `config('zoom.*')` üzerinden, asla response'a girmez |
| Token'lar şifreli saklanır | `'encrypted'` cast (AES-256-CBC, APP_KEY ile) |
| Token'lar log'a girmez | `$hidden = ['access_token_enc', 'refresh_token_enc']` |
| Timing-safe karşılaştırma | `hash_equals()` — webhook imzası için |
| Replay attack koruması | 5 dakika timestamp penceresi |
| Zoom hata 124 = yeniden auth | Retry yok, `ZoomReauthorizationRequiredException` fırlatılır |
| JWT her istekte yeniden üretilir | Cache yok |
| ZAK/OBF DB'ye kaydedilmez | Kısa ömürlü, kullanılmadan hemen önce çekilir |

---

## Proje Yapısı

```
laravel-api/
├── app/
│   ├── Exceptions/Zoom/
│   │   └── ZoomReauthorizationRequiredException.php
│   ├── Http/Controllers/Zoom/
│   │   ├── MeetingAuthController.php   ← POST /api/zoom/meeting-auth
│   │   ├── OAuthController.php         ← GET /zoom/oauth/redirect|callback
│   │   └── WebhookController.php       ← POST /api/zoom/webhook
│   ├── Jobs/
│   │   └── ProcessZoomWebhookEvent.php ← Async webhook işleme
│   ├── Models/
│   │   ├── ZoomMeeting.php
│   │   ├── ZoomOauthToken.php          ← 'encrypted' cast
│   │   ├── ZoomVideoSession.php
│   │   └── ZoomWebhookEvent.php        ← 'array' cast (JSONB)
│   └── Services/Zoom/
│       ├── ZoomJwtService.php          ← Meeting SDK JWT üretimi
│       ├── ZoomMeetingService.php      ← Meeting CRUD (Zoom REST API)
│       ├── ZoomOAuthService.php        ← OAuth code flow + token saklama
│       └── ZoomTokenService.php        ← ZAK / OBF (saklanmaz)
├── bootstrap/
│   └── app.php                         ← API routing + CSRF muafiyet
├── config/
│   └── zoom.php                        ← Tüm Zoom konfigürasyonu
├── routes/
│   ├── api.php                         ← API route'ları
│   └── web.php                         ← OAuth web route'ları
└── tests/Unit/
    └── ZoomJwtServiceTest.php          ← 11 unit test
```
