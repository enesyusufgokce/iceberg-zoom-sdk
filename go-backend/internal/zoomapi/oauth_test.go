package zoomapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"go-backend/internal/config"
)

func testConfig(apiBaseURL, oauthTokenURL string) *config.Config {
	return &config.Config{
		OAuthClientID:     "client-id",
		OAuthClientSecret: "client-secret",
		OAuthRedirectURI:  "http://localhost:8080/api/zoom/oauth/callback",
		APIBaseURL:        apiBaseURL,
		OAuthTokenURL:     oauthTokenURL,
	}
}

func TestAuthorizationURL(t *testing.T) {
	svc := NewOAuthService(testConfig("", "https://zoom.us/oauth/token"))

	url, err := svc.AuthorizationURL("csrf-state-123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	want := "https://zoom.us/oauth/authorize?client_id=client-id&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fzoom%2Foauth%2Fcallback&response_type=code&state=csrf-state-123"
	if url != want {
		t.Fatalf("AuthorizationURL() = %q, want %q", url, want)
	}
}

func TestAuthorizationURL_MissingConfig(t *testing.T) {
	svc := NewOAuthService(&config.Config{})
	if _, err := svc.AuthorizationURL("state"); err == nil {
		t.Fatal("expected error when OAuth client id/redirect uri are not configured")
	}
}

func TestExchangeCode_Success(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth/token", func(w http.ResponseWriter, r *http.Request) {
		if user, pass, ok := r.BasicAuth(); !ok || user != "client-id" || pass != "client-secret" {
			t.Errorf("expected basic auth with client credentials, got user=%q pass=%q ok=%v", user, pass, ok)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatalf("parse form: %v", err)
		}
		if r.Form.Get("grant_type") != "authorization_code" || r.Form.Get("code") != "auth-code-1" {
			t.Errorf("unexpected token request form: %v", r.Form)
		}

		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token":  "access-token-1",
			"refresh_token": "refresh-token-1",
			"scope":         "meeting:write",
			"expires_in":    3600,
		})
	})
	mux.HandleFunc("/v2/users/me", func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); auth != "Bearer access-token-1" {
			t.Errorf("expected bearer token forwarded to profile call, got %q", auth)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "zoom-user-1", "email": "agent@iceberg.test"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewOAuthService(testConfig(server.URL+"/v2", server.URL+"/oauth/token"))

	token, err := svc.ExchangeCode("auth-code-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if token.AccessToken != "access-token-1" || token.RefreshToken != "refresh-token-1" {
		t.Fatalf("unexpected token set: %+v", token)
	}
	if token.ZoomEmail != "agent@iceberg.test" || token.ZoomUserID != "zoom-user-1" {
		t.Fatalf("expected profile to be attached to token set, got %+v", token)
	}
}

func TestRefreshToken_ReauthRequired(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth/token", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"code": 124, "message": "Invalid refresh token"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewOAuthService(testConfig(server.URL+"/v2", server.URL+"/oauth/token"))

	_, err := svc.RefreshToken("revoked-refresh-token")
	if err != ErrReauthRequired {
		t.Fatalf("expected ErrReauthRequired, got %v", err)
	}
}
