package zoomjwt

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"

	"go-backend/internal/config"
)

func testConfig() *config.Config {
	return &config.Config{
		SDKClientID:     "sdk-client-id",
		SDKClientSecret: "sdk-client-secret",
		SDKJWTTTL:       7200,
		VideoSDKKey:     "video-key",
		VideoSDKSecret:  "video-secret",
	}
}

func TestGenerateMeetingSignature_ClaimsAndSignature(t *testing.T) {
	cfg := testConfig()
	svc := New(cfg)

	signed, err := svc.GenerateMeetingSignature("1234567890", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(signed, &claims, func(t *jwt.Token) (any, error) {
		return []byte(cfg.SDKClientSecret), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("token did not verify with the SDK secret: %v", err)
	}

	if claims["mn"] != "1234567890" {
		t.Errorf("expected mn claim to be the meeting number, got %v", claims["mn"])
	}
	if claims["sdkKey"] != cfg.SDKClientID || claims["appKey"] != cfg.SDKClientID {
		t.Errorf("expected sdkKey/appKey claims to be the SDK client id, got %v / %v", claims["sdkKey"], claims["appKey"])
	}
	if role, _ := claims["role"].(float64); role != 1 {
		t.Errorf("expected role claim to be 1, got %v", claims["role"])
	}
}

func TestGenerateMeetingSignature_InvalidRole(t *testing.T) {
	svc := New(testConfig())
	if _, err := svc.GenerateMeetingSignature("123", 2); err == nil {
		t.Fatal("expected an error for a role other than 0 or 1")
	}
}

func TestGenerateVideoToken_ClaimsAndSignature(t *testing.T) {
	cfg := testConfig()
	svc := New(cfg)

	signed, err := svc.GenerateVideoToken("demo-session", 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(signed, &claims, func(t *jwt.Token) (any, error) {
		return []byte(cfg.VideoSDKSecret), nil
	})
	if err != nil || !token.Valid {
		t.Fatalf("token did not verify with the Video SDK secret: %v", err)
	}

	if claims["tpc"] != "demo-session" {
		t.Errorf("expected tpc claim to be the session name, got %v", claims["tpc"])
	}
	if claims["app_key"] != cfg.VideoSDKKey {
		t.Errorf("expected app_key claim to be the Video SDK key, got %v", claims["app_key"])
	}
}

func TestGenerateVideoToken_MissingCredentials(t *testing.T) {
	cfg := testConfig()
	cfg.VideoSDKKey = ""
	cfg.VideoSDKSecret = ""
	svc := New(cfg)

	if _, err := svc.GenerateVideoToken("session", 1); err == nil {
		t.Fatal("expected an error when Video SDK credentials are not configured")
	}
}

func TestMeetingSignature_WrongSecretFailsVerification(t *testing.T) {
	svc := New(testConfig())

	signed, err := svc.GenerateMeetingSignature("123", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = jwt.Parse(signed, func(t *jwt.Token) (any, error) {
		return []byte("wrong-secret"), nil
	})
	if err == nil {
		t.Fatal("expected verification to fail against the wrong secret")
	}
}
