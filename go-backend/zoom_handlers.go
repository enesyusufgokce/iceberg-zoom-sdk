package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"

	"go-backend/internal/config"
	"go-backend/internal/tokenstore"
	"go-backend/internal/webhook"
	"go-backend/internal/zoomapi"
)

const oauthStateCookie = "zoom_oauth_state"

// oauthRedirectHandler starts the OAuth 2.0 authorization code flow: it
// stores a random CSRF state in a short-lived cookie and 302s the browser
// to Zoom's consent screen. Must be opened as a real navigation (not fetch).
func oauthRedirectHandler(svc *zoomapi.OAuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		state, err := randomState()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to generate state")
			return
		}

		authURL, err := svc.AuthorizationURL(state)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     oauthStateCookie,
			Value:    state,
			Path:     "/",
			HttpOnly: true,
			MaxAge:   300,
			SameSite: http.SameSiteLaxMode,
		})

		http.Redirect(w, r, authURL, http.StatusFound)
	}
}

// oauthCallbackHandler validates the CSRF state, exchanges the code for a
// token set, stashes it in the in-memory store, and reports the connected
// Zoom account back to the browser.
func oauthCallbackHandler(svc *zoomapi.OAuthService, store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(oauthStateCookie)
		if err != nil || cookie.Value == "" || cookie.Value != r.URL.Query().Get("state") {
			writeError(w, http.StatusUnprocessableEntity, "invalid OAuth state, possible CSRF attempt")
			return
		}
		http.SetCookie(w, &http.Cookie{Name: oauthStateCookie, Value: "", Path: "/", MaxAge: -1})

		if zoomErr := r.URL.Query().Get("error"); zoomErr != "" {
			writeError(w, http.StatusBadRequest, "zoom oauth error: "+zoomErr)
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			writeError(w, http.StatusBadRequest, "authorization code missing from callback")
			return
		}

		token, err := svc.ExchangeCode(code)
		if err != nil {
			writeError(w, http.StatusBadGateway, "token exchange failed: "+err.Error())
			return
		}

		store.Set(token)

		writeJSON(w, http.StatusOK, map[string]string{
			"status":     "connected",
			"zoomEmail":  token.ZoomEmail,
			"zoomUserId": token.ZoomUserID,
		})
	}
}

// oauthStatusHandler lets the frontend check whether the demo currently
// holds a connected Zoom account, without exposing the access token itself.
func oauthStatusHandler(store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, ok := store.Get()
		if !ok {
			writeJSON(w, http.StatusOK, map[string]any{"connected": false})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"connected": true,
			"zoomEmail": token.ZoomEmail,
		})
	}
}

// createMeetingHandler calls Zoom's Create Meeting API using the OAuth
// access token obtained via the flow above (not the SDK JWT secret).
func createMeetingHandler(svc *zoomapi.MeetingService, store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := resolveAccessToken(w, store)
		if !ok {
			return
		}

		var params map[string]any
		if r.ContentLength != 0 {
			if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
				writeError(w, http.StatusBadRequest, "invalid JSON body")
				return
			}
		}
		if params == nil {
			params = map[string]any{}
		}
		if _, has := params["topic"]; !has {
			params["topic"] = "Lifesycle Meeting"
		}
		if _, has := params["type"]; !has {
			params["type"] = 2 // scheduled meeting
		}

		meeting, err := svc.CreateMeeting(accessToken, params)
		if err != nil {
			handleZoomAPIError(w, err)
			return
		}

		writeJSON(w, http.StatusCreated, meeting)
	}
}

func getMeetingHandler(svc *zoomapi.MeetingService, store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := resolveAccessToken(w, store)
		if !ok {
			return
		}

		meeting, err := svc.GetMeeting(accessToken, r.PathValue("id"))
		if err != nil {
			handleZoomAPIError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, meeting)
	}
}

// zakHandler fetches a Zoom Access Key so an authenticated host can start
// their own meeting from the Meeting SDK. Requires a completed OAuth flow.
func zakHandler(svc *zoomapi.TokenService, store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := resolveAccessToken(w, store)
		if !ok {
			return
		}

		zak, err := svc.GetZAK(accessToken)
		if err != nil {
			handleZoomAPIError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"zak": zak})
	}
}

// obfHandler fetches an On-Behalf-Of token to join a specific meeting as a
// licensed user without that user's own OAuth session.
func obfHandler(svc *zoomapi.TokenService, store *tokenstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, accessToken, ok := resolveAccessToken(w, store)
		if !ok {
			return
		}

		meetingID := r.URL.Query().Get("meeting_id")
		if meetingID == "" {
			writeError(w, http.StatusUnprocessableEntity, "meeting_id query parameter is required")
			return
		}

		obf, err := svc.GetOBF(accessToken, meetingID)
		if err != nil {
			handleZoomAPIError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"obf": obf})
	}
}

// webhookHandler verifies Zoom's HMAC signature and timestamp, answers the
// one-time endpoint.url_validation challenge, and otherwise just logs the
// verified event (a production handler would enqueue it, mirroring
// laravel-api's ProcessZoomWebhookEvent job).
func webhookHandler(cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rawBody, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read request body")
			return
		}

		timestamp := r.Header.Get("x-zm-request-timestamp")
		signature := r.Header.Get("x-zm-signature")

		ts, err := strconv.ParseInt(timestamp, 10, 64)
		if err != nil || !webhook.IsTimestampFresh(ts, cfg.WebhookTimestampToleranceS) {
			writeError(w, http.StatusUnauthorized, "request timestamp too old")
			return
		}

		if !webhook.VerifySignature(cfg.WebhookSecretToken, timestamp, string(rawBody), signature) {
			writeError(w, http.StatusUnauthorized, "invalid signature")
			return
		}

		var payload map[string]any
		_ = json.Unmarshal(rawBody, &payload)

		eventType, _ := payload["event"].(string)

		if eventType == "endpoint.url_validation" {
			inner, _ := payload["payload"].(map[string]any)
			plainToken, _ := inner["plainToken"].(string)

			writeJSON(w, http.StatusOK, map[string]string{
				"plainToken":     plainToken,
				"encryptedToken": webhook.EncryptedToken(cfg.WebhookSecretToken, plainToken),
			})
			return
		}

		log.Printf("[Zoom Webhook] verified event received: %s", eventType)
		writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
	}
}

func resolveAccessToken(w http.ResponseWriter, store *tokenstore.Store) (*zoomapi.TokenSet, string, bool) {
	token, ok := store.Get()
	if !ok {
		writeError(w, http.StatusUnauthorized, "no connected Zoom account, complete GET /api/zoom/oauth/redirect first")
		return nil, "", false
	}
	return token, token.AccessToken, true
}

func handleZoomAPIError(w http.ResponseWriter, err error) {
	if errors.Is(err, zoomapi.ErrReauthRequired) {
		writeError(w, http.StatusUnauthorized, "zoom authorization revoked, reconnect via /api/zoom/oauth/redirect")
		return
	}
	writeError(w, http.StatusBadGateway, err.Error())
}

func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
