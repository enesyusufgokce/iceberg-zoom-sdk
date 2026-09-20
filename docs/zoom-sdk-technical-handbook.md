# Zoom SDK Technical Handbook
### Meeting SDK · Video SDK · Zoom Apps SDK · Authentication & Tokens
*Prepared for: Zoom SDK Deep Dive mission (Iceberg / Lifesycle) — reflects Zoom's platform as of August 2026*

---

## 1. How the pieces fit together

Zoom's developer platform is not one SDK — it's a family of products that solve different problems. Before touching code, it's worth being precise about which one you actually need.

| Product | What it does | Mental model |
|---|---|---|
| **Zoom REST APIs** | Create/manage meetings, users, recordings, webinars via HTTP calls | "Control Zoom from your backend" |
| **Meeting SDK** | Embeds the real Zoom meeting/webinar client experience inside your app or site | "Zoom, inside your app" |
| **Video SDK** | Gives you raw video/audio/chat/screen-share building blocks with no Zoom UI at all | "Your app, powered by Zoom's infrastructure" |
| **Zoom Apps SDK** | Lets you build a mini-app that runs *inside* the Zoom client (e.g., a panel during a live meeting) | "Your app, inside Zoom" |
| **Webhooks** | Real-time server-to-server event notifications (meeting started, recording completed, etc.) | "Zoom tells your backend what just happened" |

The confusion in the mission brief between "App SDK" and "Meeting/Video SDK" is common — the three are genuinely different products, aimed at opposite directions of integration (Zoom-in-your-app vs. your-app-in-Zoom). Section 4 covers the Zoom Apps SDK separately for this reason.

---

## 2. Meeting SDK

### 2.1 What it is
The Meeting SDK renders the actual Zoom meeting/webinar experience — the same client Zoom users already know — inside your own application or website. You're not rebuilding video calling; you're embedding Zoom's.

### 2.2 Views (Web SDK specifically)
- **Client View** — looks and behaves like the standalone Zoom client, dropped into your page.
- **Component View** — the meeting is broken into modular UI components (video gallery, controls, chat, etc.) <cite index="5-1">that displays the Meeting SDK in components on your website</cite>, so you can arrange it inside your own layout.

Native platforms (iOS, Android, Windows, macOS) instead offer a **default UI** (Zoom-client-like) and a **custom UI** (you build your own visual layer on top of the SDK's controls).

### 2.3 Core mechanics
- **Creating meetings**: typically done via the REST API from your backend (not the SDK itself) — you create the meeting, get back a meeting number/password, then use the SDK to join or start it.
- **Starting vs joining**: the SDK signature includes a `role` value — `1` to start (host) a meeting, `0` to join as a participant.
- **Anonymous users**: can join without any Zoom login at all, using just the SDK JWT signature.
- **Logged-in / authenticated users**: sign in via SSO inside the SDK; the Meeting SDK does **not** support direct username/password login.
- **Host/on-behalf-of join**: to start or join a meeting as a specific Zoom user (e.g. the meeting host), you additionally pass that user's **ZAK** or **OBF** token alongside the JWT signature (see Section 5).
- **Security settings**: <cite index="7-1">the Meeting SDK respects all Zoom meeting and webinar security settings</cite>, so waiting rooms, passcodes, and authentication profiles configured in the Zoom portal carry through.
- **Billing note**: anonymous-user SDK usage bills to the app owner (Client ID/Secret holder); when a user hosts on behalf of another user via ZAK/OBF, usage bills to that meeting host instead.

### 2.4 The March 2026 authorization change (important for this mission)
This is a live, recent change the team must design around, not an edge case:

- **Old behavior**: an SDK app could join *any* external meeting (hosted by another account) using only its SDK credentials — no attribution to a real person.
- **New behavior, enforced since March 2, 2026**: <cite index="4-1">apps joining meetings hosted by external accounts must be authorized using an On Behalf Of (OBF) token</cite>, a ZAK token, or must use RTMS (Real-Time Media Streams) for continuous/streaming use cases instead of joining as a participant.
- This only applies to **cross-account** joins. <cite index="8-1">Meeting SDK apps that join meetings on a user's own account can, but are not required to, use the OBF token</cite>.
- Practical effect for POCs: if Lifesycle's Meeting SDK use case only ever joins meetings created within Iceberg's own Zoom account, this doesn't block you. If it needs to join meetings hosted by *external* Zoom accounts (e.g. a customer's own Zoom account), OBF/ZAK/RTMS becomes mandatory, not optional.

### 2.5 What's available vs not
Available: recording integration hooks, in-meeting events/callbacks (participant join/leave, active speaker, chat, etc.), virtual backgrounds, raw audio/video access on native platforms (useful for custom transcription/analysis), webinar support.
Not available / constrained: you cannot fully re-skin the underlying meeting protocol; UI customization on native platforms is deeper than on Web; direct password-based login is not supported; joining external meetings without proper attribution is now blocked outright.

---

## 3. Video SDK

### 3.1 What it is
Video SDK gives you Zoom's underlying real-time video/audio/chat/screen-share infrastructure with **no Zoom meeting UI at all** — you design 100% of the interface. <cite index="27-1">The Zoom Video SDK is your app powered by Zoom tech: instead of embedding a standard meeting, you use Zoom's infrastructure to build a custom real-time communication application</cite>.

### 3.2 Meeting SDK vs Video SDK — the actual decision rule
<cite index="27-1">In short: Meeting SDK is for embedding an existing Zoom meeting experience; Video SDK is for creating a fully custom one</cite>. Concretely:

- Use **Meeting SDK** when the Zoom-branded meeting/webinar experience itself is acceptable or desirable to end users, and when interoperability with regular Zoom clients (a mix of app users and normal Zoom desktop/mobile users in the same call) matters.
- Use **Video SDK** when your product needs a fully custom, on-brand UI, when end users should never see "Zoom" as a name/logo, or when the use case is closer to "build a communication feature" than "embed a meeting."

### 3.3 Capabilities
- Custom **sessions** (Video SDK's equivalent of a "meeting," but with no Zoom scheduling/host semantics attached) — created and joined via session IDs.
- Full audio, video, chat, screen sharing, and participant management APIs.
- <cite index="28-1">Sessions support up to 1,000 co-hosts/participants</cite>, though UI is entirely up to you — Zoom only provides the media layer and defined components, not layout.
- Available across <cite index="28-1">iOS, Android, React Native, Web, and Windows/macOS</cite>.
- Raw media access exists on native platforms for advanced use cases (custom analysis pipelines, AI processing of streams).
- Not compatible with standard Zoom Meetings — a Video SDK session is a separate concept from a Zoom meeting and normal Zoom clients cannot join it.

### 3.4 Authentication
Video SDK uses the same JWT-signature pattern as Meeting SDK conceptually — <cite index="29-1">a JSON Web Token generated using the SDK key and secret from the developer account, used to securely authenticate the SDK within the application</cite> — but the credential pair and JWT payload shape are specific to Video SDK apps (distinct app registration from Meeting SDK, even though both live in the Zoom Marketplace/App dashboard).

### 3.5 Lifesycle relevance
Video SDK is the stronger fit for use cases where Lifesycle wants a fully branded experience with no visible "Zoom" — e.g. an in-app video valuation or virtual viewing feature that looks like native Lifesycle UI, not a Zoom window. Meeting SDK is the stronger fit where interoperability with ordinary Zoom users/clients matters more than branding (e.g. an agent hosting a call that some attendees join from a normal Zoom desktop app).

---

## 4. Zoom Apps SDK (the "third SDK" — distinct from Meeting/Video SDK)

This product isn't in the mission brief by name, but it's worth documenting explicitly because it's easy to conflate with Meeting/Video SDK given all three sit in the same Marketplace.

- **What it is**: a JavaScript SDK for building a mini-application that runs **inside the Zoom client itself** — as a panel, in-meeting experience, or app-in-Zoom surface — rather than embedding Zoom inside your app.
- **Direction of integration**: opposite of Meeting/Video SDK. Meeting/Video SDK = "Zoom capability inside Lifesycle." Zoom Apps SDK = "Lifesycle capability inside the Zoom client."
- **Typical use case**: a CRM panel visible to a Zoom user during their meeting, pulling in contact/property context from Lifesycle while they're on a Zoom call they started normally (not one embedded via Meeting/Video SDK).
- **Authentication**: Zoom Apps use Zoom's OAuth flow (the app is installed/authorized like any Zoom Marketplace OAuth app) plus a Zoom Apps-specific in-client SDK context, distinct from the Meeting SDK JWT model.
- **Recommendation for this mission**: lower priority than Meeting/Video SDK for Lifesycle's near-term goals (embedding meetings into the CRM), but worth a short research note if Iceberg later wants a "Lifesycle panel inside Zoom" rather than "Zoom inside Lifesycle."

---

## 5. Authentication & Tokens — the part that actually causes confusion

Zoom SDK auth is not one system; it's several token types that serve different purposes and are frequently confused even by experienced teams. <cite index="17-1">Zoom doesn't have a single authentication system — it has several, and a token that works for one purpose won't work for another</cite>. Here is the model, disentangled.

### 5.1 SDK Client ID / Client Secret
- The base app credentials, generated when you register a Meeting SDK or Video SDK app in the Zoom Marketplace/App dashboard.
- <cite index="13-1">SDK credentials themselves don't expire</cite> — they're the long-lived root secret from which everything else is derived.
- **Must live server-side only.** Never expose Client Secret to a browser or mobile client.

### 5.2 SDK JWT (the "signature") — always required
- <cite index="7-1">JWTs are the base authorization token generated by your app; they let the SDK join a meeting or webinar within the app owner's account as a participant or non-login user using only the JWT</cite>.
- <cite index="2-1">A JWT signature authenticates your application to use the Meeting SDK, generated server-side using your SDK Client ID and Client Secret. Every Meeting SDK join requires a JWT signature</cite> — this is not optional or conditional; it's the floor requirement for any SDK join.
- Generated on your backend (never in the browser), then handed to the frontend SDK call.
- Structure: Header, Payload, Signature. For the Web Meeting SDK the payload includes `sdkKey`, `mn` (meeting number), `role` (0 participant / 1 host), `iat`, `exp`, `tokenExp`.
- **Expiry rules**: <cite index="20-1">the Meeting SDK expects a minimum JWT exp date of 1800 seconds (30 minutes) greater than the iat value, and a maximum of 48 hours greater than iat</cite>. In practice, teams commonly generate short-lived tokens (minutes) per join request rather than long-lived ones.
- Common failure mode: server clock drift causing `iat`/`exp` validation errors — worth calling out explicitly in the Troubleshooting Guide deliverable.

### 5.3 ZAK (Zoom Access Key) — represents a *person*
- <cite index="17-1">A ZAK token represents a person — used when the app joins on behalf of an authenticated user</cite>.
- Retrieved via REST API (`GET /users/{userId}/token?type=zak`), requires the user to have connected their Zoom account via OAuth first: <cite index="4-1">to generate a valid ZAK token you must authorize your app via OAuth so it can securely access the user's account; without that OAuth connection, the app cannot obtain a ZAK token or join meetings as that user</cite>.
- Used to **start** a meeting as a specific host (`role: 1` + host's ZAK) or to join a meeting/webinar that requires sign-in.
- Tied to a live Zoom session — <cite index="7-1">a user can invalidate active ZAK tokens by choosing "Sign Me Out from All Devices"</cite> in their Zoom profile.

### 5.4 OBF (On Behalf Of) — represents an *app*, newer token, now enforced
- <cite index="17-1">An OBF token represents the app itself — used when it joins as an automated participant, such as a recording or note-taking tool</cite>, though minting one still requires a real OAuth-authorized user behind it.
- <cite index="8-1">It's a short-lived, single-use token retrieved via REST API and authorized with the user's OAuth access token</cite>: `GET /users/me/token?type=onbehalf&meeting_id={id}`.
- <cite index="6-1">Zoom validates that the user who authorized the app is actually present in the meeting when the app joins with an OBF token</cite> — and <cite index="6-1">if that authorizing user leaves the meeting, the app is immediately disconnected</cite>.
- **ZAK and OBF are mutually exclusive on a single join call** — <cite index="2-1">you pass one or the other, never both</cite>.
- **Enforcement timeline**: required since **March 2, 2026** for Meeting SDK apps joining meetings hosted by accounts other than the app's own, per Section 2.4. Not required for same-account joins.
- **Minimum SDK version**: <cite index="4-1">apps must be on Meeting SDK 5.17.5 or later to remain compliant with OBF requirements</cite>.

### 5.5 OAuth access & refresh tokens
- Standard Zoom OAuth 2.0 — used to call the REST API on a user's behalf (create meetings, fetch a ZAK/OBF token, read user profile) and to authorize a Zoom user's connection to your app in the first place.
- Required scope for OBF retrieval: `user:read:token`. Required scopes for ZAK retrieval: `user:read` (or `user:read:admin` for admin-managed apps).
- Access tokens are short-lived; refresh tokens are used to mint new access tokens without re-prompting the user for consent.

### 5.6 Quick reference table

| Token | Represents | Lifetime | Generated by | Used for |
|---|---|---|---|---|
| Client ID / Secret | The app itself | Long-lived (until rotated) | Zoom Marketplace, at app creation | Signing JWTs; never sent to browser |
| SDK JWT / signature | The app, for one join | Minutes–hours (30 min–48 hr window) | Your backend, per join | Every single Meeting/Video SDK join, always |
| ZAK | A specific Zoom user | Tied to active Zoom session | REST API, after user OAuth | Starting a meeting as host; joining as a signed-in user |
| OBF | The app, attributed to a present user | Short-lived, single-use | REST API, after user OAuth | Required for joining meetings hosted by *external* accounts (since Mar 2, 2026) |
| OAuth access/refresh token | A specific Zoom user's consent | Access: short-lived; Refresh: long-lived | Zoom OAuth flow | Calling REST APIs; retrieving ZAK/OBF |

### 5.7 Security rules worth encoding as team standards
- SDK JWTs are **always** generated server-side. <cite index="15-1">Signatures must be generated server-side to protect your SDK Secret</cite> — this is non-negotiable and should be a Laravel/Go backend responsibility, never client-side JS.
- Client Secret, Client ID pairing, and OAuth client secrets never touch the browser or mobile bundle.
- For multi-tenant scenarios (multiple Lifesycle customers/accounts), each tenant's OAuth-connected Zoom identity and resulting ZAK/OBF tokens must stay scoped to that tenant — don't cache or reuse tokens across tenant boundaries.
- External-meeting join paths (OBF/ZAK) should have explicit retry-on-failure handling: <cite index="8-1">if an SDK join fails because the authorizing user hasn't yet entered the meeting, the app must retry the join attempt</cite> rather than treating it as a hard failure.

---

## 6. Direct implications for this mission's deliverables

- **SDK Comparison Guide**: the decision tree is (a) need Zoom-branded UI + interoperate with real Zoom clients → Meeting SDK; (b) need fully custom branded UI, no visible Zoom → Video SDK; (c) need Lifesycle functionality surfaced inside someone else's Zoom client → Zoom Apps SDK (separate research track).
- **Authentication Guide**: structure it around the table in 5.6, not around "how JWTs work" in isolation — the recurring real-world confusion is JWT vs ZAK vs OBF vs OAuth token, not any single token in isolation.
- **POC 1 (Meeting SDK)**: should explicitly test the same-account join path first (no OBF needed), then, if scope allows, a second pass demonstrating OBF-token join against an external test account, since that's the compliance-critical path post-March-2026.
- **Troubleshooting Guide**: JWT clock-drift/expiry errors and "invalid signature" are the most common failure Zoom's own community reports — worth a dedicated section with the exact `iat`/`exp`/`tokenExp` rules from Section 5.2.
- **Final Recommendation**: given the OBF enforcement is recent (March 2026) and Meeting SDK bot/automation patterns are actively shifting toward **RTMS** for continuous/streaming use cases, it's worth explicitly asking whether any Lifesycle use case (e.g. automated recording/transcription bots) is better served by RTMS than by a Meeting SDK participant-join pattern.

---

*Sources: Zoom Developer Docs (developers.zoom.us), Zoom's official OBF FAQ and transition blog post, Zoom Developer Forum threads on Meeting SDK vs Video SDK, and third-party technical write-ups (WebRTC.ventures, VideoSDK.live, Recall.ai, MeetStream.ai) current as of August 2026. Given how recently the OBF enforcement took effect, verify exact scopes/version numbers against Zoom's live docs before finalizing the Authentication Guide for handover.*
