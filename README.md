# Zoom SDK Laravel API — POC Backend

This project is a Laravel backend POC for Zoom SDK integration tailored for **Iceberg Lifecycle CRM**.
The objective is to demonstrate an end-to-end working Zoom SDK authentication flow (Meeting SDK JWT + OAuth + Video SDK Token).

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Iceberg CRM Frontend                           │
│     public/msdk/index.html     ────────     public/vsdk/index.html  │
└────────────┬───────────────────────────────────┬────────────────────┘
             │ POST /api/zoom/meeting-auth        │ POST /api/zoom/token
             ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     iceberg-zoom-sdk (Laravel)                      │
│                                                                     │
│  MeetingAuthController ── ZoomJwtService (firebase/php-jwt)         │
│  VideoSessionController── ZoomJwtService (Video SDK tokens)         │
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

## Installation

### 1. Install Dependencies

```bash
composer install
```

### 2. Prepare Environment File

```bash
cp .env.example .env
php artisan key:generate
```

> The `APP_KEY` value is used by Laravel's `encrypted` cast for token encryption.
> Changing it will make existing stored database tokens unreadable.

### 3. Configure `.env`

Fill in the following sections sequentially (refer to the corresponding Zoom setup steps for details):

```dotenv
# PostgreSQL — Neon
DB_CONNECTION=pgsql
DB_HOST=<neon-host>.neon.tech
DB_PORT=5432
DB_DATABASE=<database-name>
DB_USERNAME=<username>
DB_PASSWORD=<password>

# Meeting SDK & Video SDK
ZOOM_SDK_CLIENT_ID=<sdk-client-id>
ZOOM_SDK_CLIENT_SECRET=<sdk-client-secret>

# OAuth
ZOOM_OAUTH_CLIENT_ID=<oauth-client-id>
ZOOM_OAUTH_CLIENT_SECRET=<oauth-client-secret>
ZOOM_OAUTH_REDIRECT_URI=http://localhost:8000/zoom/oauth/callback

# Webhook
ZOOM_WEBHOOK_SECRET_TOKEN=<webhook-secret-token>
```

### 4. Database

Tables are already created on Neon (no migration needed):

- `zoom_oauth_tokens`
- `zoom_meetings`
- `zoom_video_sessions`
- `zoom_webhook_events`

To verify the database connection:

```bash
php artisan db:show
```

### 5. Start the Server

You can use the provided startup script:

```bash
./start.sh
```

Or run the Laravel development server manually:

```bash
php artisan serve
# → http://localhost:8000
```

Frontend POC interfaces:
- **Meeting SDK POC**: `http://localhost:8000/msdk/`
- **Video SDK POC**: `http://localhost:8000/vsdk/`

---

## Creating a Zoom Marketplace App

### Step 1 — Create a General App

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop** → **Build App**
2. Select **General App** → Enter an app name → Click **Create**

### Step 2 — Add Meeting SDK Feature

1. Navigate to the **Feature** tab on the app page
2. Enable the **Meeting SDK** section
3. Retrieve **Client ID** and **Client Secret** → Add them to `.env`:
   ```dotenv
   ZOOM_SDK_CLIENT_ID=...
   ZOOM_SDK_CLIENT_SECRET=...
   ```

### Step 3 — Add OAuth Feature

1. Under **Feature**, enable the **OAuth** section
2. Add **Redirect URL**: `http://localhost:8000/zoom/oauth/callback`
3. Retrieve **Client ID** and **Client Secret** → Add them to `.env`:
   ```dotenv
   ZOOM_OAUTH_CLIENT_ID=...
   ZOOM_OAUTH_CLIENT_SECRET=...
   ```

### Step 4 — Add Required OAuth Scopes

Add the following scopes in the **Scopes** tab:

| Scope | Purpose |
|---|---|
| `user:read:zak` | Required to obtain ZAK (Zoom Access Key) |
| `user:read:token` | Required to obtain OBF (On-Behalf-Of) token |
| `meeting:write:meeting` | Required to create meetings |
| `meeting:read:meeting` | Required to fetch meeting information |

### Step 5 — Add Webhook Endpoint

1. Navigate to **Feature** → **Event Subscriptions** → **+ Add Event Subscription**
2. **Event notification endpoint URL**: `https://<your-domain>/api/zoom/webhook`
   - For local development, you can use [ngrok](https://ngrok.com/):
     ```bash
     ngrok http 8000
     # → https://xxxx.ngrok.io/api/zoom/webhook
     ```
3. Retrieve the **Secret Token** value → Add it to `.env`:
   ```dotenv
   ZOOM_WEBHOOK_SECRET_TOKEN=...
   ```
4. Subscribe to the desired events (e.g., `meeting.started`, `meeting.ended`, `recording.completed`)
5. Click **Validate** — The Laravel backend automatically handles and responds to the URL validation challenge.

---

## API Reference

### `POST /api/zoom/meeting-auth`

Generates a Meeting SDK JWT signature. The frontend invokes this endpoint prior to calling `ZoomMtg.join()`.

**Request:**
```json
{
  "meeting_number": "123456789",
  "role": 0
}
```

`role`: `0` = attendee, `1` = host

**Response (200):**
```json
{
  "signature": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sdkKey": "your-sdk-client-id"
}
```

> The Client Secret is **never** included in the response.

---

### `POST /api/zoom/token`

Generates a Video SDK session token.

**Request:**
```json
{
  "sessionName": "my-session-name",
  "role": 1
}
```

`role`: `0` = participant, `1` = host

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `GET /zoom/oauth/redirect`

Redirects the user to the Zoom consent screen.

**Query params (POC):**
```
?user_id=1
```

---

### `GET /zoom/oauth/callback`

Exchanges the authorization code returned by Zoom for an access token and stores it in the database.

---

### `POST /api/zoom/webhook`

Receives Zoom webhook events. Excluded from CSRF protection — security is validated via HMAC signature verification.

---

## Running Tests

```bash
# Run only Zoom JWT tests
php artisan test --filter=ZoomJwtServiceTest

# Run all test suites
php artisan test
```

### Test Coverage Summary

`ZoomJwtServiceTest` validates:
- `exp - iat` duration falls within the required range `[1800, 172800]`
- Configured TTL value is strictly respected
- `sdkKey`, `appKey`, `mn`, `role`, and `tokenExp` fields are properly set
- `iat` is set 30 seconds in the past to prevent clock skew issues
- HS256 algorithm is used for signing
- Invalid roles, out-of-range TTLs, and missing credentials trigger exceptions
- All valid TTL thresholds (1800, 7200, and 172800 seconds) pass correctly
- Valid Video SDK session tokens are generated with appropriate claims

---

## Security Best Practices

| Rule | Implementation |
|---|---|
| SDK / OAuth Client Secrets kept strictly on backend | Accessed via `config('zoom.*')`, never exposed in responses |
| Tokens stored encrypted | Laravel `'encrypted'` cast (AES-256-CBC with `APP_KEY`) |
| Tokens excluded from logs / serialization | `$hidden = ['access_token_enc', 'refresh_token_enc']` |
| Timing-safe signature comparison | `hash_equals()` used for webhook verification |
| Replay attack prevention | 5-minute timestamp validity window |
| Zoom Error 124 triggers re-authorization | No infinite retries; throws `ZoomReauthorizationRequiredException` |
| JWT regenerated per request | No caching for auth signatures |
| ZAK / OBF tokens not persisted to DB | Short-lived, fetched on-demand immediately before use |

---

## Project Structure

```
.
├── app/
│   ├── Exceptions/Zoom/
│   │   └── ZoomReauthorizationRequiredException.php
│   ├── Http/Controllers/Zoom/
│   │   ├── MeetingAuthController.php   ← POST /api/zoom/meeting-auth
│   │   ├── VideoSessionController.php  ← POST /api/zoom/token
│   │   ├── OAuthController.php         ← GET /zoom/oauth/redirect|callback
│   │   └── WebhookController.php       ← POST /api/zoom/webhook
│   ├── Jobs/
│   │   └── ProcessZoomWebhookEvent.php ← Async webhook processing
│   ├── Models/
│   │   ├── ZoomMeeting.php
│   │   ├── ZoomOauthToken.php          ← 'encrypted' cast
│   │   ├── ZoomVideoSession.php
│   │   └── ZoomWebhookEvent.php        ← 'array' cast (JSONB)
│   └── Services/Zoom/
│       ├── ZoomJwtService.php          ← Meeting & Video SDK JWT token generation
│       ├── ZoomMeetingService.php      ← Meeting CRUD (Zoom REST API)
│       ├── ZoomOAuthService.php        ← OAuth code flow + token storage
│       └── ZoomTokenService.php        ← ZAK / OBF (not stored)
├── bootstrap/
│   └── app.php                         ← API routing + CSRF exemptions
├── config/
│   └── zoom.php                        ← Zoom configuration
├── public/
│   ├── msdk/                           ← Meeting SDK Frontend POC
│   └── vsdk/                           ← Video SDK Frontend POC
├── routes/
│   ├── api.php                         ← API routes
│   └── web.php                         ← OAuth web routes & aliases
├── start.sh                            ← Dev server starter script
└── tests/
    ├── Feature/
    │   └── ZoomAuthEndpointsTest.php   ← Auth endpoints feature tests
    └── Unit/
        └── ZoomJwtServiceTest.php      ← Unit tests for JWT generation
```
