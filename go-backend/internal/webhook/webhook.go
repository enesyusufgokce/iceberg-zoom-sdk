// Package webhook verifies and answers Zoom webhook requests. It mirrors
// laravel-api's WebhookController so the HMAC verification and URL
// validation challenge can be compared directly against the PHP version.
package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

// VerifySignature checks Zoom's x-zm-signature header: HMAC-SHA256 over
// "v0:{timestamp}:{rawBody}" using the webhook's secret token.
func VerifySignature(secret, timestamp, rawBody, receivedSignature string) bool {
	if receivedSignature == "" {
		return false
	}

	message := fmt.Sprintf("v0:%s:%s", timestamp, rawBody)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	expected := "v0=" + hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(receivedSignature))
}

// IsTimestampFresh rejects replayed requests whose timestamp header is
// older or newer than the configured tolerance window (default 300s).
func IsTimestampFresh(timestampUnix int64, toleranceSeconds int) bool {
	delta := time.Now().Unix() - timestampUnix
	if delta < 0 {
		delta = -delta
	}
	return delta <= int64(toleranceSeconds)
}

// EncryptedToken answers Zoom's endpoint.url_validation challenge: Zoom
// sends a plainToken and expects it back HMAC-SHA256-signed with the same
// webhook secret, proving we control the endpoint before Zoom enables it.
func EncryptedToken(secret, plainToken string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(plainToken))
	return hex.EncodeToString(mac.Sum(nil))
}
