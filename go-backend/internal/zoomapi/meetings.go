package zoomapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"go-backend/internal/config"
)

type Meeting struct {
	ID        string `json:"id"`
	UUID      string `json:"uuid"`
	Topic     string `json:"topic"`
	JoinURL   string `json:"join_url"`
	StartURL  string `json:"start_url,omitempty"`
	StartTime string `json:"start_time,omitempty"`
}

type MeetingService struct {
	c *client
}

func NewMeetingService(cfg *config.Config) *MeetingService {
	return &MeetingService{c: newClient(cfg)}
}

// CreateMeeting calls POST /users/me/meetings on behalf of the connected
// Zoom account identified by accessToken. params matches Zoom's Create
// Meeting request body (topic, type, start_time, duration, agenda, ...).
func (m *MeetingService) CreateMeeting(accessToken string, params map[string]any) (*Meeting, error) {
	body, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	req, err := m.c.authedRequest(http.MethodPost, "/users/me/meetings", accessToken, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	data, err := m.c.do(req)
	if err != nil {
		return nil, err
	}
	if isReauthCode(data) {
		return nil, ErrReauthRequired
	}

	return &Meeting{
		ID:        fmt.Sprintf("%v", data["id"]),
		UUID:      fmt.Sprintf("%v", data["uuid"]),
		Topic:     fmt.Sprintf("%v", data["topic"]),
		JoinURL:   fmt.Sprintf("%v", data["join_url"]),
		StartURL:  fmt.Sprintf("%v", data["start_url"]),
		StartTime: fmt.Sprintf("%v", data["start_time"]),
	}, nil
}

// GetMeeting calls GET /meetings/{meetingId}.
func (m *MeetingService) GetMeeting(accessToken, meetingID string) (map[string]any, error) {
	req, err := m.c.authedRequest(http.MethodGet, "/meetings/"+meetingID, accessToken, nil)
	if err != nil {
		return nil, err
	}

	data, err := m.c.do(req)
	if err != nil {
		return nil, err
	}
	if isReauthCode(data) {
		return nil, ErrReauthRequired
	}

	return data, nil
}
