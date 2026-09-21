package zoomapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateMeeting_Success(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/meetings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer host-access-token" {
			t.Errorf("expected bearer token, got %q", auth)
		}

		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if body["topic"] != "Property Viewing" {
			t.Errorf("expected topic to be forwarded, got %v", body["topic"])
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":         123456789,
			"uuid":       "abc-uuid",
			"topic":      "Property Viewing",
			"join_url":   "https://zoom.us/j/123456789",
			"start_url":  "https://zoom.us/s/123456789",
			"start_time": "2026-09-25T10:00:00Z",
		})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewMeetingService(testConfig(server.URL+"/v2", ""))

	meeting, err := svc.CreateMeeting("host-access-token", map[string]any{
		"topic": "Property Viewing",
		"type":  2,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if meeting.JoinURL != "https://zoom.us/j/123456789" {
		t.Fatalf("unexpected meeting: %+v", meeting)
	}
}

func TestCreateMeeting_ReauthRequired(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/meetings", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"code": 124, "message": "Invalid access token"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewMeetingService(testConfig(server.URL+"/v2", ""))

	_, err := svc.CreateMeeting("expired-token", map[string]any{"topic": "x"})
	if err != ErrReauthRequired {
		t.Fatalf("expected ErrReauthRequired, got %v", err)
	}
}

func TestCreateMeeting_APIError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v2/users/me/meetings", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]any{"message": "Rate limit exceeded"})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	svc := NewMeetingService(testConfig(server.URL+"/v2", ""))

	if _, err := svc.CreateMeeting("token", map[string]any{"topic": "x"}); err == nil {
		t.Fatal("expected an error for a non-2xx Zoom response")
	}
}
