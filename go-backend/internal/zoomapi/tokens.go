package zoomapi

import (
	"fmt"
	"net/http"

	"go-backend/internal/config"
)

// TokenService fetches short-lived ZAK/OBF tokens from Zoom. Unlike the SDK
// JWT (self-signed with our own secret), these are minted by Zoom itself and
// require a valid OAuth access token for the meeting host's account.
type TokenService struct {
	c *client
}

func NewTokenService(cfg *config.Config) *TokenService {
	return &TokenService{c: newClient(cfg)}
}

// GetZAK fetches a Zoom Access Key for the authenticated host to start
// their own meeting from the Meeting SDK without re-entering credentials.
func (t *TokenService) GetZAK(accessToken string) (string, error) {
	return t.fetchToken(accessToken, "/users/me/token?type=zak")
}

// GetOBF fetches an On-Behalf-Of token that lets the app join a meeting as
// a specific licensed user without that user's own OAuth session.
func (t *TokenService) GetOBF(accessToken, meetingID string) (string, error) {
	return t.fetchToken(accessToken, "/users/me/token?type=onbehalf&meeting_id="+meetingID)
}

func (t *TokenService) fetchToken(accessToken, path string) (string, error) {
	req, err := t.c.authedRequest(http.MethodGet, path, accessToken, nil)
	if err != nil {
		return "", err
	}

	data, err := t.c.do(req)
	if err != nil {
		return "", err
	}
	if isReauthCode(data) {
		return "", ErrReauthRequired
	}

	token, _ := data["token"].(string)
	if token == "" {
		return "", fmt.Errorf("zoom response missing token: %v", data)
	}
	return token, nil
}
