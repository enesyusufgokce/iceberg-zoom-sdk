# Zoom Meeting SDK POC (Client View)

A minimal proof of concept for embedding the Zoom Meeting SDK (Web, Client View)
in a web page. It proves out the SDK JWT authentication flow: the signature
required to join a meeting is generated on a backend using the Meeting SDK
Client ID/Secret, never in the browser, and the frontend uses that signature
to join a meeting via the Client View embed.

## Prerequisites

- Node.js (v18+ recommended)
- A Zoom Marketplace **General App** with the **Meeting SDK** feature enabled
- That app's **Client ID** and **Client Secret**

## Setup

1. Copy/clone this folder.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   SDK_KEY=<your Meeting SDK Client ID>
   SDK_SECRET=<your Meeting SDK Client Secret>
   ```

## Running

Run the backend and a static file server in two separate terminals.

**Terminal 1 — backend (port 4000):**
```
node server.js
```

**Terminal 2 — frontend (port 3000):**
```
npx serve . -l 3000
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

In the form, enter:

- **Client ID** — the same Client ID configured in `.env` (`SDK_KEY`)
- **Meeting Number**
- **Passcode**
- **Display Name**

Click **Join**. The page will request a signature from the backend and use it
to join the meeting in Client View.

## Architecture

```
Browser (index.html)          Backend (server.js)
  |  1. POST /jwt                    |
  |  { meetingNumber, role } ------->|
  |                                  |  builds JWT payload
  |                                  |  (appKey, sdkKey, mn, role, iat, exp)
  |                                  |  signs with SDK_SECRET (HS256)
  |  <----------- { signature } -----|
  |                                  |
  |  2. ZoomMtg.init() / .join()     |
  |     with signature + Client ID   |
  v                                  |
Zoom Client View embed
```

The Client Secret (`SDK_SECRET`) is only ever used on the backend to sign the
JWT. The browser only ever receives the resulting signature, not the secret
itself.

## Known limitations

- Joining meetings hosted on **other** Zoom accounts requires app review by
  Zoom and, starting **March 2, 2026**, additional ZAK/OBF tokens for
  cross-account join.
- This POC has only been tested joining meetings hosted on the **same**
  account as the Marketplace app's credentials.

## Security note

- `.env` is listed in `.gitignore` and should never be committed.
- Secrets stay on the backend at all times; only the signed JWT (signature)
  is sent to the browser.
