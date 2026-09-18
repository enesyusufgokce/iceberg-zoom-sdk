<?php

namespace App\Services\Zoom;

use App\Exceptions\Zoom\ZoomReauthorizationRequiredException;
use Illuminate\Support\Facades\Http;

// Retrieves short-lived ZAK and OBF tokens from Zoom API (never stored in DB).
class ZoomTokenService
{
    private string $apiBaseUrl;

    public function __construct()
    {
        $this->apiBaseUrl = (string) config('zoom.api_base_url');
    }

    /**
     * Fetch ZAK token for authenticated host joining their own meeting.
     */
    public function getZak(string $accessToken): string
    {
        $response = Http::withToken($accessToken)
            ->get("{$this->apiBaseUrl}/users/me/token", ['type' => 'zak'])
            ->throw();

        $data = $response->json();
        $this->guard124($data);

        return (string) $data['token'];
    }

    /**
     * Fetch OBF token for joining a meeting on behalf of a participant.
     */
    public function getObf(string $accessToken, string $meetingId): string
    {
        $response = Http::withToken($accessToken)
            ->get("{$this->apiBaseUrl}/users/me/token", [
                'type'       => 'onbehalf',
                'meeting_id' => $meetingId,
            ])
            ->throw();

        $data = $response->json();
        $this->guard124($data);

        return (string) $data['token'];
    }

    private function guard124(array $data): void
    {
        if (isset($data['code']) && (int) $data['code'] === 124) {
            throw new ZoomReauthorizationRequiredException();
        }
    }
}
