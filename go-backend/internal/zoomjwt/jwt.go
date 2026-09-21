// Package zoomjwt generates Meeting SDK and Video SDK JWTs (HS256).
// Mirrors laravel-api's ZoomJwtService so the two backends can be compared directly.
package zoomjwt

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"go-backend/internal/config"
)

type Service struct {
	cfg *config.Config
}

func New(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

// SDKKey returns the Meeting SDK client ID, safe to expose to the frontend.
func (s *Service) SDKKey() string {
	return s.cfg.SDKClientID
}

// GenerateMeetingSignature builds a Meeting SDK JWT for joining/hosting a meeting.
// role: 0 = attendee, 1 = host.
func (s *Service) GenerateMeetingSignature(meetingNumber string, role int) (string, error) {
	if role != 0 && role != 1 {
		return "", fmt.Errorf("role must be 0 (attendee) or 1 (host)")
	}

	iat := time.Now().Unix() - 30 // 30s clock skew buffer
	exp := iat + int64(s.cfg.SDKJWTTTL)

	claims := jwt.MapClaims{
		"appKey":   s.cfg.SDKClientID,
		"sdkKey":   s.cfg.SDKClientID,
		"mn":       meetingNumber,
		"role":     role,
		"iat":      iat,
		"exp":      exp,
		"tokenExp": exp,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.SDKClientSecret))
}

// GenerateVideoToken builds a Video SDK JWT for joining/hosting a session.
// role: 0 = participant, 1 = host.
func (s *Service) GenerateVideoToken(sessionName string, role int) (string, error) {
	if s.cfg.VideoSDKKey == "" || s.cfg.VideoSDKSecret == "" {
		return "", fmt.Errorf("ZOOM_VIDEO_SDK_KEY or ZOOM_VIDEO_SDK_SECRET is not configured")
	}

	iat := time.Now().Unix()
	exp := iat + int64(s.cfg.SDKJWTTTL)

	claims := jwt.MapClaims{
		"app_key":   s.cfg.VideoSDKKey,
		"tpc":       sessionName,
		"role_type": role,
		"version":   1,
		"iat":       iat,
		"exp":       exp,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.VideoSDKSecret))
}
