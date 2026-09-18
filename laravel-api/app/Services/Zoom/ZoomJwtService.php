<?php

namespace App\Services\Zoom;

use Firebase\JWT\JWT;
use InvalidArgumentException;

// Generates Meeting SDK JWTs using HMAC-SHA256. Client secret is never exposed.
class ZoomJwtService
{
    private string $sdkKey;
    private string $sdkSecret;
    private int $ttl;

    public function __construct()
    {
        $this->sdkKey    = (string) config('zoom.sdk_client_id');
        $this->sdkSecret = (string) config('zoom.sdk_client_secret');
        $this->ttl       = (int) config('zoom.sdk_jwt_ttl', 7200);

        $this->validateConfig();
    }

    /**
     * Generate Meeting SDK JWT (role: 0 = attendee, 1 = host).
     */
    public function generate(string $meetingNumber, int $role): string
    {
        if (! in_array($role, [0, 1], true)) {
            throw new InvalidArgumentException('Role must be 0 (attendee) or 1 (host).');
        }

        $iat = time() - 30; // 30s clock skew buffer
        $exp = $iat + $this->ttl;

        $this->assertExpWindow($iat, $exp);

        $payload = [
            'appKey'   => $this->sdkKey,
            'sdkKey'   => $this->sdkKey,
            'mn'       => $meetingNumber,
            'role'     => $role,
            'iat'      => $iat,
            'exp'      => $exp,
            'tokenExp' => $exp,
        ];

        return JWT::encode($payload, $this->sdkSecret, 'HS256');
    }

    /**
     * Generate Video SDK JWT for session joins (role: 0 = participant, 1 = host).
     */
    public function generateVideoToken(string $sessionName, int $role = 1): string
    {
        $videoKey    = (string) config('zoom.video_sdk_key');
        $videoSecret = (string) config('zoom.video_sdk_secret');

        if (empty($videoKey) || empty($videoSecret)) {
            throw new \RuntimeException('ZOOM_VIDEO_SDK_KEY or ZOOM_VIDEO_SDK_SECRET is not configured.');
        }

        $iat = time();
        $exp = $iat + $this->ttl;

        $payload = [
            'app_key'   => $videoKey,
            'tpc'       => $sessionName,
            'role_type' => $role,
            'version'   => 1,
            'iat'       => $iat,
            'exp'       => $exp,
        ];

        return JWT::encode($payload, $videoSecret, 'HS256');
    }

    private function validateConfig(): void
    {
        if (empty($this->sdkKey)) {
            throw new \RuntimeException('ZOOM_SDK_CLIENT_ID is not configured.');
        }

        if (empty($this->sdkSecret)) {
            throw new \RuntimeException('ZOOM_SDK_CLIENT_SECRET is not configured.');
        }

        if ($this->ttl < 1800 || $this->ttl > 172800) {
            throw new \RuntimeException(
                sprintf('ZOOM_SDK_JWT_TTL must be between 1800 and 172800 seconds. Got: %d', $this->ttl)
            );
        }
    }

    // Zoom enforces: 1800 <= (exp - iat) <= 172800
    private function assertExpWindow(int $iat, int $exp): void
    {
        $delta = $exp - $iat;

        if ($delta < 1800 || $delta > 172800) {
            throw new \RuntimeException(
                sprintf('JWT exp/iat window (%d s) is outside Zoom allowed range [1800, 172800].', $delta)
            );
        }
    }
}
