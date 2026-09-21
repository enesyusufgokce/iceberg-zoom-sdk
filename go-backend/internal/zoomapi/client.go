package zoomapi

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go-backend/internal/config"
)

type client struct {
	cfg  *config.Config
	http *http.Client
}

func newClient(cfg *config.Config) *client {
	return &client{cfg: cfg, http: &http.Client{Timeout: 10 * time.Second}}
}

// authedRequest builds a request against the Zoom API base URL with a Bearer token.
func (c *client) authedRequest(method, path string, token string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, c.cfg.APIBaseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return req, nil
}

func (c *client) do(req *http.Request) (map[string]any, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("zoom request failed: %w", err)
	}
	defer resp.Body.Close()

	var data map[string]any
	if resp.ContentLength != 0 {
		if err := json.NewDecoder(resp.Body).Decode(&data); err != nil && err != io.EOF {
			return nil, fmt.Errorf("decode zoom response: %w", err)
		}
	}

	if resp.StatusCode >= 400 {
		return data, fmt.Errorf("zoom API error (status %d): %v", resp.StatusCode, data)
	}

	// Zoom returns HTTP 200/201 with an in-body error code (e.g. 124 = token
	// revoked) for some endpoints, so callers still need to check data["code"].
	return data, nil
}

func isReauthCode(data map[string]any) bool {
	code, ok := data["code"]
	return ok && fmt.Sprintf("%v", code) == "124"
}
