<?php

namespace Tests\Unit;

use App\Services\Zoom\ZoomJwtService;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Unit tests for ZoomJwtService.
 *
 * These tests run without a real Zoom account or database connection.
 * They verify that the JWT payload is constructed correctly and that
 * Zoom's required exp/iat window constraint is respected.
 *
 * Zoom enforces: 1800 <= (exp - iat) <= 172800
 */
class ZoomJwtServiceTest extends TestCase
{
    private const FAKE_SDK_KEY          = 'test-sdk-key-abc123';
    private const FAKE_SDK_SECRET       = 'test-sdk-secret-xyz789-must-be-long-enough';
    private const FAKE_VIDEO_SDK_KEY    = 'test-video-key-456';
    private const FAKE_VIDEO_SDK_SECRET = 'test-video-secret-xyz-must-be-long-enough';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'zoom.sdk_client_id'     => self::FAKE_SDK_KEY,
            'zoom.sdk_client_secret' => self::FAKE_SDK_SECRET,
            'zoom.video_sdk_key'     => self::FAKE_VIDEO_SDK_KEY,
            'zoom.video_sdk_secret'  => self::FAKE_VIDEO_SDK_SECRET,
            'zoom.sdk_jwt_ttl'       => 7200,
        ]);
    }

    #[Test]
    public function it_generates_a_valid_video_sdk_token(): void
    {
        $service = new ZoomJwtService();
        $token   = $service->generateVideoToken('room-101', 1);

        $decoded = JWT::decode($token, new Key(self::FAKE_VIDEO_SDK_SECRET, 'HS256'));

        $this->assertEquals(self::FAKE_VIDEO_SDK_KEY, $decoded->app_key);
        $this->assertEquals('room-101', $decoded->tpc);
        $this->assertEquals(1, $decoded->role_type);
        $this->assertEquals(1, $decoded->version);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // exp / iat window tests
    // ─────────────────────────────────────────────────────────────────────────

    #[Test]
    public function it_generates_a_token_with_exp_iat_within_zooms_required_window(): void
    {
        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $delta = $decoded->exp - $decoded->iat;

        $this->assertGreaterThanOrEqual(
            1800,
            $delta,
            "exp - iat ({$delta}s) must be at least 1800s (Zoom minimum).",
        );

        $this->assertLessThanOrEqual(
            172800,
            $delta,
            "exp - iat ({$delta}s) must not exceed 172800s (Zoom maximum).",
        );
    }

    #[Test]
    public function it_uses_the_configured_ttl_for_exp(): void
    {
        config(['zoom.sdk_jwt_ttl' => 3600]); // 1 hour
        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        // Because iat = time() - 30, delta = ttl (not ttl - 30).
        $delta = $decoded->exp - $decoded->iat;

        $this->assertEquals(3600, $delta);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Payload field tests
    // ─────────────────────────────────────────────────────────────────────────

    #[Test]
    public function it_includes_sdkKey_and_appKey_in_the_payload(): void
    {
        $service = new ZoomJwtService();
        $jwt     = $service->generate('111222333', 1);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $this->assertEquals(self::FAKE_SDK_KEY, $decoded->sdkKey);
        $this->assertEquals(self::FAKE_SDK_KEY, $decoded->appKey);
    }

    #[Test]
    public function it_includes_the_meeting_number_in_the_payload(): void
    {
        $meetingNumber = '987654321';
        $service       = new ZoomJwtService();
        $jwt           = $service->generate($meetingNumber, 0);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $this->assertEquals($meetingNumber, $decoded->mn);
    }

    #[Test]
    public function it_includes_the_role_in_the_payload(): void
    {
        $service = new ZoomJwtService();

        $jwtAttendee = $service->generate('123', 0);
        $jwtHost     = $service->generate('123', 1);

        $decodedAttendee = JWT::decode($jwtAttendee, new Key(self::FAKE_SDK_SECRET, 'HS256'));
        $decodedHost     = JWT::decode($jwtHost,     new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $this->assertEquals(0, $decodedAttendee->role);
        $this->assertEquals(1, $decodedHost->role);
    }

    #[Test]
    public function it_sets_tokenExp_equal_to_exp(): void
    {
        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $this->assertEquals($decoded->exp, $decoded->tokenExp);
    }

    #[Test]
    public function it_sets_iat_slightly_in_the_past_for_clock_skew(): void
    {
        $before  = time();
        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);
        $after   = time();

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        // iat = time() - 30 at the moment of signing.
        $this->assertLessThanOrEqual($before - 29, $decoded->iat, 'iat should be ~30s in the past');
        $this->assertGreaterThanOrEqual($after - 31, $decoded->iat, 'iat should not be further than 31s in the past');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validation / guard tests
    // ─────────────────────────────────────────────────────────────────────────

    #[Test]
    public function it_throws_when_role_is_invalid(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $service = new ZoomJwtService();
        $service->generate('123456789', 2); // 2 is not a valid role
    }

    #[Test]
    public function it_throws_when_ttl_is_below_zoom_minimum(): void
    {
        $this->expectException(\RuntimeException::class);

        config(['zoom.sdk_jwt_ttl' => 1799]); // Below 1800 minimum

        new ZoomJwtService();
    }

    #[Test]
    public function it_throws_when_ttl_exceeds_zoom_maximum(): void
    {
        $this->expectException(\RuntimeException::class);

        config(['zoom.sdk_jwt_ttl' => 172801]); // Above 172800 maximum

        new ZoomJwtService();
    }

    #[Test]
    public function it_throws_when_sdk_key_is_empty(): void
    {
        $this->expectException(\RuntimeException::class);

        config(['zoom.sdk_client_id' => '']);

        new ZoomJwtService();
    }

    #[Test]
    public function it_throws_when_sdk_secret_is_empty(): void
    {
        $this->expectException(\RuntimeException::class);

        config(['zoom.sdk_client_secret' => '']);

        new ZoomJwtService();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Signature algorithm test
    // ─────────────────────────────────────────────────────────────────────────

    #[Test]
    public function it_signs_the_token_with_hs256(): void
    {
        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);

        // The JWT header encodes the algorithm. Parse the header to check.
        $parts  = explode('.', $jwt);
        $header = json_decode(base64_decode(str_pad($parts[0], strlen($parts[0]) % 4 == 0 ? strlen($parts[0]) : strlen($parts[0]) + (4 - strlen($parts[0]) % 4), '=')), true);

        $this->assertEquals('HS256', $header['alg']);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Data providers
    // ─────────────────────────────────────────────────────────────────────────

    public static function validTtlProvider(): array
    {
        return [
            'minimum allowed' => [1800],
            'default 2 hours' => [7200],
            'maximum allowed' => [172800],
        ];
    }

    #[Test]
    #[DataProvider('validTtlProvider')]
    public function it_accepts_all_valid_ttl_values(int $ttl): void
    {
        config(['zoom.sdk_jwt_ttl' => $ttl]);

        $service = new ZoomJwtService();
        $jwt     = $service->generate('123456789', 0);

        $decoded = JWT::decode($jwt, new Key(self::FAKE_SDK_SECRET, 'HS256'));

        $delta = $decoded->exp - $decoded->iat;

        $this->assertGreaterThanOrEqual(1800, $delta);
        $this->assertLessThanOrEqual(172800, $delta);
    }
}
