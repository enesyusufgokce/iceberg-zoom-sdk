// Package tokenstore holds the OAuth token for the demo in memory.
// laravel-api persists one encrypted ZoomOauthToken row per Lifesycle user
// in Postgres; this POC keeps a single in-process token so the OAuth flow
// and downstream API calls can be demonstrated without a database.
package tokenstore

import (
	"sync"

	"go-backend/internal/zoomapi"
)

type Store struct {
	mu    sync.RWMutex
	token *zoomapi.TokenSet
}

func New() *Store {
	return &Store{}
}

func (s *Store) Set(token *zoomapi.TokenSet) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = token
}

func (s *Store) Get() (*zoomapi.TokenSet, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.token == nil {
		return nil, false
	}
	return s.token, true
}
