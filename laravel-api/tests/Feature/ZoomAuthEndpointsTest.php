<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ZoomAuthEndpointsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'zoom.sdk_client_id'     => 'test-msdk-client-id',
            'zoom.sdk_client_secret' => 'test-msdk-client-secret-1234567890',
            'zoom.video_sdk_key'     => 'test-vsdk-client-key',
            'zoom.video_sdk_secret'  => 'test-vsdk-client-secret-1234567890',
            'zoom.sdk_jwt_ttl'       => 7200,
        ]);
    }

    #[Test]
    public function it_issues_meeting_sdk_signature_with_snake_case_params(): void
    {
        $response = $this->postJson('/api/zoom/meeting-auth', [
            'meeting_number' => '1234567890',
            'role'           => 0,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['signature', 'sdkKey'])
            ->assertJson(['sdkKey' => 'test-msdk-client-id']);
    }

    #[Test]
    public function it_issues_meeting_sdk_signature_with_camel_case_params(): void
    {
        $response = $this->postJson('/api/zoom/meeting-auth', [
            'meetingNumber' => '1234567890',
            'role'          => 1,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['signature', 'sdkKey'])
            ->assertJson(['sdkKey' => 'test-msdk-client-id']);
    }

    #[Test]
    public function it_issues_video_sdk_token(): void
    {
        $response = $this->postJson('/api/zoom/token', [
            'sessionName' => 'iceberg-inspection-101',
            'role'        => 1,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'sessionName'])
            ->assertJson(['sessionName' => 'iceberg-inspection-101']);
    }

    #[Test]
    public function it_validates_required_fields_for_meeting_auth(): void
    {
        $response = $this->postJson('/api/zoom/meeting-auth', []);
        $response->assertStatus(422);
    }

    #[Test]
    public function it_validates_required_fields_for_video_token(): void
    {
        $response = $this->postJson('/api/zoom/token', []);
        $response->assertStatus(422);
    }
}
