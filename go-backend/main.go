package main

import (
	"encoding/json"
	"log"
	"net/http"

	"go-backend/internal/config"
	"go-backend/internal/tokenstore"
	"go-backend/internal/zoomapi"
	"go-backend/internal/zoomjwt"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	jwtService := zoomjwt.New(cfg)
	oauthService := zoomapi.NewOAuthService(cfg)
	meetingService := zoomapi.NewMeetingService(cfg)
	tokenService := zoomapi.NewTokenService(cfg)
	store := tokenstore.New()

	mux := http.NewServeMux()

	// SDK JWT auth (self-signed, no Zoom round trip)
	mux.HandleFunc("POST /api/zoom/meeting-auth", meetingAuthHandler(jwtService))
	mux.HandleFunc("POST /api/zoom/token", videoTokenHandler(jwtService))
	mux.HandleFunc("POST /api/zoom/video-token", videoTokenHandler(jwtService))

	// OAuth 2.0 authorization code flow
	mux.HandleFunc("GET /api/zoom/oauth/redirect", oauthRedirectHandler(oauthService))
	mux.HandleFunc("GET /api/zoom/oauth/callback", oauthCallbackHandler(oauthService, store))
	mux.HandleFunc("GET /api/zoom/oauth/status", oauthStatusHandler(store))

	// Zoom REST API calls that require an OAuth access token
	mux.HandleFunc("POST /api/zoom/meetings", createMeetingHandler(meetingService, store))
	mux.HandleFunc("GET /api/zoom/meetings/{id}", getMeetingHandler(meetingService, store))
	mux.HandleFunc("GET /api/zoom/token/zak", zakHandler(tokenService, store))
	mux.HandleFunc("GET /api/zoom/token/obf", obfHandler(tokenService, store))

	// Inbound Zoom webhook
	mux.HandleFunc("POST /api/zoom/webhook", webhookHandler(cfg))

	log.Printf("go-backend listening on http://localhost:%s", cfg.Port)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, withCORS(mux)))
}

type meetingAuthRequest struct {
	MeetingNumber string `json:"meetingNumber"`
	MeetingNumSnk string `json:"meeting_number"`
	Role          *int   `json:"role"`
}

// meetingAuthHandler mirrors laravel-api's MeetingAuthController@issue.
func meetingAuthHandler(svc *zoomjwt.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req meetingAuthRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		meetingNumber := req.MeetingNumber
		if meetingNumber == "" {
			meetingNumber = req.MeetingNumSnk
		}
		if meetingNumber == "" {
			writeError(w, http.StatusUnprocessableEntity, "meeting_number or meetingNumber is required.")
			return
		}

		role := 0
		if req.Role != nil {
			role = *req.Role
		}

		signature, err := svc.GenerateMeetingSignature(meetingNumber, role)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"signature": signature,
			"sdkKey":    svc.SDKKey(),
		})
	}
}

type videoTokenRequest struct {
	SessionName    string `json:"sessionName"`
	SessionNameSnk string `json:"session_name"`
	Role           *int   `json:"role"`
}

// videoTokenHandler mirrors laravel-api's VideoSessionController@issue.
func videoTokenHandler(svc *zoomjwt.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req videoTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}

		sessionName := req.SessionName
		if sessionName == "" {
			sessionName = req.SessionNameSnk
		}
		if sessionName == "" {
			writeError(w, http.StatusUnprocessableEntity, "sessionName or session_name is required.")
			return
		}

		role := 1
		if req.Role != nil {
			role = *req.Role
		}

		token, err := svc.GenerateVideoToken(sessionName, role)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"token":       token,
			"sessionName": sessionName,
		})
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
