package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port string

	SDKClientID     string
	SDKClientSecret string
	SDKJWTTTL       int

	VideoSDKKey    string
	VideoSDKSecret string

	OAuthClientID     string
	OAuthClientSecret string
	OAuthRedirectURI  string

	WebhookSecretToken         string
	WebhookTimestampToleranceS int

	APIBaseURL    string
	OAuthTokenURL string
}

// Load reads .env (if present) and validates required Zoom credentials.
// Mirrors laravel-api's config/zoom.php so both backends are configured the same way.
func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:            envOr("PORT", "8080"),
		SDKClientID:     os.Getenv("ZOOM_SDK_CLIENT_ID"),
		SDKClientSecret: os.Getenv("ZOOM_SDK_CLIENT_SECRET"),
		VideoSDKKey:     os.Getenv("ZOOM_VIDEO_SDK_KEY"),
		VideoSDKSecret:  os.Getenv("ZOOM_VIDEO_SDK_SECRET"),

		OAuthClientID:     os.Getenv("ZOOM_OAUTH_CLIENT_ID"),
		OAuthClientSecret: os.Getenv("ZOOM_OAUTH_CLIENT_SECRET"),
		OAuthRedirectURI:  os.Getenv("ZOOM_OAUTH_REDIRECT_URI"),

		WebhookSecretToken: os.Getenv("ZOOM_WEBHOOK_SECRET_TOKEN"),

		APIBaseURL:    envOr("ZOOM_API_BASE_URL", "https://api.zoom.us/v2"),
		OAuthTokenURL: envOr("ZOOM_OAUTH_TOKEN_URL", "https://zoom.us/oauth/token"),
	}

	ttl, err := strconv.Atoi(envOr("ZOOM_SDK_JWT_TTL", "7200"))
	if err != nil {
		return nil, fmt.Errorf("ZOOM_SDK_JWT_TTL must be an integer: %w", err)
	}
	cfg.SDKJWTTTL = ttl

	tolerance, err := strconv.Atoi(envOr("ZOOM_WEBHOOK_TIMESTAMP_TOLERANCE", "300"))
	if err != nil {
		return nil, fmt.Errorf("ZOOM_WEBHOOK_TIMESTAMP_TOLERANCE must be an integer: %w", err)
	}
	cfg.WebhookTimestampToleranceS = tolerance

	if cfg.SDKClientID == "" {
		return nil, fmt.Errorf("ZOOM_SDK_CLIENT_ID is not configured")
	}
	if cfg.SDKClientSecret == "" {
		return nil, fmt.Errorf("ZOOM_SDK_CLIENT_SECRET is not configured")
	}
	// Zoom enforces: 1800 <= (exp - iat) <= 172800
	if cfg.SDKJWTTTL < 1800 || cfg.SDKJWTTTL > 172800 {
		return nil, fmt.Errorf("ZOOM_SDK_JWT_TTL must be between 1800 and 172800 seconds, got: %d", cfg.SDKJWTTTL)
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
