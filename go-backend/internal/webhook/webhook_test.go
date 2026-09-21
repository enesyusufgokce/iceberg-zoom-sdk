package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"
)

// independentSignature recomputes the signature by hand (not via the
// package under test) so a typo in VerifySignature's own formula wouldn't
// be masked by testing it against itself.
func independentSignature(secret, timestamp, body string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte("v0:" + timestamp + ":" + body))
	return "v0=" + hex.EncodeToString(h.Sum(nil))
}

func TestVerifySignature_Valid(t *testing.T) {
	secret := "test-secret"
	timestamp := "1700000000"
	body := `{"event":"meeting.started"}`

	sig := independentSignature(secret, timestamp, body)

	if !VerifySignature(secret, timestamp, body, sig) {
		t.Fatal("expected valid signature to verify")
	}
}

func TestVerifySignature_WrongSecret(t *testing.T) {
	sig := independentSignature("secret-a", "1700000000", "body")
	if VerifySignature("secret-b", "1700000000", "body", sig) {
		t.Fatal("expected signature computed with a different secret to fail")
	}
}

func TestVerifySignature_TamperedBody(t *testing.T) {
	sig := independentSignature("secret", "1700000000", "original-body")
	if VerifySignature("secret", "1700000000", "tampered-body", sig) {
		t.Fatal("expected signature to fail against a modified body")
	}
}

func TestVerifySignature_EmptySignatureRejected(t *testing.T) {
	if VerifySignature("secret", "1700000000", "body", "") {
		t.Fatal("expected empty signature to be rejected")
	}
}

func TestIsTimestampFresh(t *testing.T) {
	now := time.Now().Unix()

	if !IsTimestampFresh(now, 300) {
		t.Fatal("expected current timestamp to be fresh")
	}
	if IsTimestampFresh(now-600, 300) {
		t.Fatal("expected a 10-minute-old timestamp to be stale under a 5-minute tolerance")
	}
	if IsTimestampFresh(now+600, 300) {
		t.Fatal("expected a timestamp 10 minutes in the future to be rejected too")
	}
}

func TestEncryptedToken_MatchesManualHMAC(t *testing.T) {
	secret := "webhook-secret"
	plainToken := "abc123"

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(plainToken))
	want := hex.EncodeToString(h.Sum(nil))

	if got := EncryptedToken(secret, plainToken); got != want {
		t.Fatalf("EncryptedToken() = %q, want %q", got, want)
	}
}
