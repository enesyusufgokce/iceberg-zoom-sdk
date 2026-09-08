# Zoom Video SDK — Proof of Concept (POC)

A Zoom Video SDK integration POC project built with Vanilla JavaScript (ES Modules), HTML5, and modern Vanilla CSS, featuring a modular architecture with no external frontend framework dependencies.

---

## Project Structure

```
zoom-vsdk-poc/
├── index.html          # Page skeleton (Lobby and Room screens, controls)
├── style.css           # Design system, dark mode theme, video grid, and animations
├── token-server.js     # Express backend service generating secure JWT tokens
├── .env                # Zoom SDK credentials (SDK_KEY, SDK_SECRET)
├── package.json        # Backend dependencies (express, jsonwebtoken, cors, dotenv)
├── README.md           # Project documentation
└── js/                 # Modular ES modules (Vanilla JS)
    ├── main.js         # Application entry point (Bootstrap)
    ├── dom.js          # Centralized DOM element references
    ├── state.js        # Application state (AppState singleton)
    ├── sdk.js          # Zoom Video SDK adapter layer
    ├── session.js      # Session lifecycle (create, join, enterRoom, cleanupRoom)
    ├── events.js       # Zoom SDK event listeners (user-added, peer-video, etc.)
    ├── controls.js     # Microphone/camera toggles and button state synchronization
    ├── tiles.js        # Participant video tile DOM factory
    ├── grid.js         # Dynamic CSS grid column manager
    ├── participants.js # Participant panel and counter management
    ├── timer.js        # Session duration timer (HH:MM:SS)
    ├── ui.js           # Screen transitions, toast notifications, and loading overlay
    ├── helpers.js      # Helper functions (getInitials)
    └── listeners.js    # DOM event listener bindings and keyboard shortcuts
```

---

## Architecture and Module Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    index.html / DOM                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│       js/main.js  ───►  js/listeners.js                     │
│       (Bootstrap)        (DOM Event Listeners)              │
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
│ (SDK Adapter) │◄────►│  (AppState)   │◄────►│  (Elements)   │
└───────┬───────┘      └───────┬───────┘      └───────────────┘
        │                      │
        ▼                      ▼
┌───────────────┐      ┌──────────────────────────────────────┐
│  Zoom SDK CDN │      │ js/tiles.js, js/grid.js,             │
│ (v2.18.0 CDN) │      │ js/participants.js, js/timer.js      │
└───────────────┘      └──────────────────────────────────────┘
```

---

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `js/state.js` | `AppState` singleton; holds session state, participants, `sdkClient`, and `sdkStream` references. |
| `js/dom.js` | Aggregates all DOM nodes into a single object; provides consistent access across modules. |
| `js/sdk.js` | The only layer directly interfacing with the Zoom Video SDK API (`initSDK`, `startLocalMedia`, `attachVideo`, `detachVideo`, `leaveSession`). |
| `js/session.js` | Session initialization, joining, entering the room (`enterRoom`), leaving, and resource cleanup (`cleanupRoom`). |
| `js/events.js` | Listens for Zoom Video SDK events (`user-added`, `user-removed`, `peer-video-state-change`, `user-updated`, `connection-change`). |
| `js/controls.js` | Microphone (Mute/Unmute) and camera (Start/Stop) toggle logic and UI state synchronization. |
| `js/tiles.js` | Produces custom video tile DOM elements (`.video-tile`) and container wrappers for Zoom SDK's `<video-player>` element. |
| `js/grid.js` | Dynamically calculates the CSS grid column count (1–5) based on participant count using the `--cols` CSS variable. |
| `js/participants.js` | Manages the participant sidebar panel and updates the header counter badge. |
| `js/timer.js` | Updates the live session elapsed timer in `HH:MM:SS` format. |
| `js/ui.js` | Screen transitions (`lobby` / `room`), dynamic toast notifications, and loading overlay. |
| `js/helpers.js` | Utility functions such as generating avatar initials from participant names (`getInitials`). |
| `js/listeners.js` | Binds button click handlers, Enter key form submission, and keyboard shortcuts (`Alt+M`, `Alt+V`). |
| `js/main.js` | Application entry point that bootstraps listeners once the DOM is ready. |

---

## Requirements and Setup

### 1. Environment Variables (.env)
Define your Zoom Video SDK credentials obtained from the Zoom Developer Portal in a `.env` file in the root directory:

```env
SDK_KEY=your_zoom_video_sdk_key_here
SDK_SECRET=your_zoom_video_sdk_secret_here
PORT=3001
```

> **Security Note:** Never expose `SDK_SECRET` in client-side code. Token generation must always be handled securely on the backend via `token-server.js`.

### 2. Install Dependencies
```bash
npm install
```

---

## Running the Application

The application requires **two separate services** to run:
1. **Token Server (Node.js/Express):** Generates JWT tokens for the Zoom Video SDK.
2. **Web Server (Static HTTP):** Serves the ES modules and frontend web interface.

### Step 1: Start the Token Server
```bash
node token-server.js
# Output: Token server running at: http://localhost:3001
```

### Step 2: Start the Web Server
Use a local HTTP server to allow the browser to load ES modules without CORS issues and to support camera/microphone permissions:

```bash
# Using Node.js npx:
npx serve .
```

Open in your browser:
`http://localhost:8080` (or `http://localhost:3000`)

---

## Zoom Video SDK Integration Details (v2.x)

Zoom Video SDK Web 2.x uses custom Canvas/WebGL-based `<video-player>` elements rather than attaching streams to traditional `<video>` tags.

### Video Stream Rendering Flow:
1. **Initialize Client:**
   ```javascript
   const client = ZoomVideo.createClient();
   await client.init('en-US', 'Global', { patchJsMedia: true });
   ```
2. **Join Session:**
   ```javascript
   await client.join(sessionName, token, userName);
   ```
3. **Start Camera and Render Video:**
   ```javascript
   const stream = client.getMediaStream();
   await stream.startVideo();
   // The SDK generates a custom <video-player> element:
   const userVideo = await stream.attachVideo(userId, 3); // 3 = 720p / HD
   containerElement.appendChild(userVideo);
   ```
4. **Stop Camera:**
   ```javascript
   await stream.stopVideo();
   await stream.detachVideo(userId);
   ```
5. **Leave Session and Cleanup:**
   ```javascript
   await client.leave(endForAll);
   ZoomVideo.destroyClient(); // Cleans up resources and memory leaks
   ```

---

## Keyboard Shortcuts

| Shortcut | Function |
|---|---|
| `Alt + M` | Toggle microphone (Mute/Unmute) |
| `Alt + V` | Toggle camera (Start/Stop Video) |
| `Enter` | Submit form when inside input fields (Session Name, Name, etc.) |

---

## Video Grid Layout Logic

The CSS Grid column count (`--cols`) updates dynamically based on the number of participants:

| Participant Count | Grid Columns |
|---|---|
| 1 | 1 column |
| 2 – 4 | 2 columns |
| 5 – 9 | 3 columns |
| 10 – 16 | 4 columns |
| 17+ | 5 columns |
