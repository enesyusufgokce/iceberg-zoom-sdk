// Package zoomapi calls the Zoom REST API (OAuth token exchange, meetings,
// ZAK/OBF tokens). It mirrors laravel-api's ZoomOAuthService/ZoomMeetingService/
// ZoomTokenService so the Go and PHP backends can be compared directly.
package zoomapi

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go-backend/internal/config"
)

// ErrReauthRequired mirrors Laravel's ZoomReauthorizationRequiredException:
// Zoom error code 124 means the refresh token was revoked and the user must
// go through the OAuth consent screen again.
var ErrReauthRequired = fmt.Errorf("zoom refresh token invalid or revoked, user must reconnect")

type TokenSet struct {
	AccessToken  string
	RefreshToken string
	Scope        string
	ExpiresAt    time.Time
	ZoomUserID   string
	ZoomEmail    string
}

type OAuthService struct {
	cfg *config.Config
	c   *client
}

func NewOAuthService(cfg *config.Config) *OAuthService {
	return &OAuthService{cfg: cfg, c: newClient(cfg)}
}

// AuthorizationURL builds the Zoom consent screen URL for a given CSRF state.
func (s *OAuthService) AuthorizationURL(state string) (string, error) {
	if s.cfg.OAuthClientID == "" || s.cfg.OAuthRedirectURI == "" {
		return "", fmt.Errorf("ZOOM_OAUTH_CLIENT_ID or ZOOM_OAUTH_REDIRECT_URI is not configured")
	}

	q := url.Values{
		"response_type": {"code"},
		"client_id":     {s.cfg.OAuthClientID},
		"redirect_uri":  {s.cfg.OAuthRedirectURI},
		"state":         {state},
	}
	return "https://zoom.us/oauth/authorize?" + q.Encode(), nil
}

// ExchangeCode swaps an authorization code for an access/refresh token pair,
// then fetches the profile so callers know which Zoom account connected.
func (s *OAuthService) ExchangeCode(code string) (*TokenSet, error) {
	if s.cfg.OAuthClientID == "" || s.cfg.OAuthClientSecret == "" {
		return nil, fmt.Errorf("ZOOM_OAUTH_CLIENT_ID or ZOOM_OAUTH_CLIENT_SECRET is not configured")
	}

	data, err := s.postForm(url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {s.cfg.OAuthRedirectURI},
	})
	if err != nil {
		return nil, err
	}

	return s.toTokenSet(data)
}

// RefreshToken exchanges a stored refresh token for a new access token.
// Returns ErrReauthRequired if Zoom reports the refresh token was revoked.
func (s *OAuthService) RefreshToken(refreshToken string) (*TokenSet, error) {
	data, err := s.postForm(url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
	})
	if err != nil {
		return nil, err
	}
	if isReauthCode(data) {
		return nil, ErrReauthRequired
	}

	return s.toTokenSet(data)
}

func (s *OAuthService) toTokenSet(data map[string]any) (*TokenSet, error) {
	accessToken, _ := data["access_token"].(string)
	if accessToken == "" {
		return nil, fmt.Errorf("zoom oauth response missing access_token: %v", data)
	}

	profile, err := s.FetchProfile(accessToken)
	if err != nil {
		return nil, fmt.Errorf("fetch zoom profile: %w", err)
	}

	expiresIn, _ := data["expires_in"].(float64)
	if expiresIn == 0 {
		expiresIn = 3600
	}

	refreshToken, _ := data["refresh_token"].(string)
	scope, _ := data["scope"].(string)

	return &TokenSet{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Scope:        scope,
		ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
		ZoomUserID:   fmt.Sprintf("%v", profile["id"]),
		ZoomEmail:    fmt.Sprintf("%v", profile["email"]),
	}, nil
}

// FetchProfile calls GET /users/me with the given access token.
func (s *OAuthService) FetchProfile(accessToken string) (map[string]any, error) {
	req, err := s.c.authedRequest(http.MethodGet, "/users/me", accessToken, nil)
	if err != nil {
		return nil, err
	}
	return s.c.do(req)
}

func (s *OAuthService) postForm(form url.Values) (map[string]any, error) {
	req, err := http.NewRequest(http.MethodPost, s.cfg.OAuthTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(s.cfg.OAuthClientID, s.cfg.OAuthClientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	return s.c.do(req)
}
