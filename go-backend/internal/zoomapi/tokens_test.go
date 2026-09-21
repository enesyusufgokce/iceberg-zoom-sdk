package zoomapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetZAK_Success(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/token", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("type") != "zak" {
			t.Errorf("expected type=zak, got %v", r.URL.Query())
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"token": "zak-token-value"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewTokenService(testConfig(server.URL+"/v2", ""))

	zak, err := svc.GetZAK("access-token")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if zak != "zak-token-value" {
		t.Fatalf("GetZAK() = %q, want zak-token-value", zak)
	}
}

func TestGetOBF_Success(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/token", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("type") != "onbehalf" || q.Get("meeting_id") != "999" {
			t.Errorf("unexpected query: %v", q)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"token": "obf-token-value"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewTokenService(testConfig(server.URL+"/v2", ""))

	obf, err := svc.GetOBF("access-token", "999")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if obf != "obf-token-value" {
		t.Fatalf("GetOBF() = %q, want obf-token-value", obf)
	}
}

func TestGetZAK_ReauthRequired(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/token", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"code": 124})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewTokenService(testConfig(server.URL+"/v2", ""))

	if _, err := svc.GetZAK("expired-token"); err != ErrReauthRequired {
		t.Fatalf("expected ErrReauthRequired, got %v", err)
	}
}
