<?php

namespace App\Services\Zoom;

use App\Exceptions\Zoom\ZoomReauthorizationRequiredException;
use App\Models\ZoomMeeting;
use App\Models\ZoomOauthToken;
use Illuminate\Support\Facades\Http;

// Interacts with Zoom Meetings REST API to create and retrieve meetings.
class ZoomMeetingService
{
    private string $apiBaseUrl;
    private ZoomOAuthService $oauthService;

    public function __construct(ZoomOAuthService $oauthService)
    {
        $this->apiBaseUrl   = (string) config('zoom.api_base_url');
        $this->oauthService = $oauthService;
    }

    /**
     * Create a new Zoom meeting via REST API and persist to zoom_meetings.
     */
    public function createMeeting(
        ZoomOauthToken $token,
        array $params,
        ?int $crmContactId = null,
        ?int $propertyId = null,
    ): ZoomMeeting {
        $accessToken = $this->resolveAccessToken($token);

        $response = Http::withToken($accessToken)
            ->post("{$this->apiBaseUrl}/users/me/meetings", $params)
            ->throw();

        $data = $response->json();
        $this->guard124($data);

        return ZoomMeeting::create([
            'oauth_token_id'    => $token->id,
            'crm_contact_id'    => $crmContactId,
            'property_id'       => $propertyId,
            'zoom_meeting_id'   => (string) $data['id'],
            'zoom_meeting_uuid' => $data['uuid'] ?? null,
            'topic'             => $data['topic'] ?? ($params['topic'] ?? 'Meeting'),
            'status'            => 'waiting',
            'start_time'        => isset($data['start_time'])
                ? \Carbon\Carbon::parse($data['start_time'])
                : null,
            'join_url'          => $data['join_url'] ?? null,
        ]);
    }

    /**
     * Fetch meeting details from Zoom.
     */
    public function getMeeting(ZoomOauthToken $token, string $meetingId): array
    {
        $accessToken = $this->resolveAccessToken($token);

        $response = Http::withToken($accessToken)
            ->get("{$this->apiBaseUrl}/meetings/{$meetingId}")
            ->throw();

        $data = $response->json();
        $this->guard124($data);

        return $data;
    }

    // Refresh access token automatically if expired
    private function resolveAccessToken(ZoomOauthToken $token): string
    {
        if ($token->isExpired()) {
            $token = $this->oauthService->refreshToken($token);
        }

        return $token->access_token_enc;
    }

    private function guard124(array $data): void
    {
        if (isset($data['code']) && (int) $data['code'] === 124) {
            throw new ZoomReauthorizationRequiredException();
        }
    }
}
