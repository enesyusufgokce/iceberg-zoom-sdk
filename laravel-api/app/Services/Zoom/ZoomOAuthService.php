<?php

namespace App\Services\Zoom;

use App\Exceptions\Zoom\ZoomReauthorizationRequiredException;
use App\Models\ZoomOauthToken;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

// Handles Zoom OAuth 2.0 authorization code flow, token exchange and refresh.
class ZoomOAuthService
{
    private string $clientId;
    private string $clientSecret;
    private string $redirectUri;
    private string $tokenUrl;

    public function __construct()
    {
        $this->clientId     = (string) config('zoom.oauth_client_id');
        $this->clientSecret = (string) config('zoom.oauth_client_secret');
        $this->redirectUri  = (string) config('zoom.oauth_redirect_uri');
        $this->tokenUrl     = (string) config('zoom.oauth_token_url');
    }

    /**
     * Build consent URL with state token embedding user ID.
     */
    public function getAuthorizationUrl(int $lifesycleUserId): array
    {
        $state = base64_encode(json_encode([
            'user_id' => $lifesycleUserId,
            'nonce'   => Str::random(16),
        ]));

        $url = 'https://zoom.us/oauth/authorize?' . http_build_query([
            'response_type' => 'code',
            'client_id'     => $this->clientId,
            'redirect_uri'  => $this->redirectUri,
            'state'         => $state,
        ]);

        return ['url' => $url, 'state' => $state];
    }

    /**
     * Exchange auth code for access and refresh tokens.
     */
    public function exchangeCodeForToken(string $code, int $lifesycleUserId): ZoomOauthToken
    {
        $response = Http::withBasicAuth($this->clientId, $this->clientSecret)
            ->asForm()
            ->post($this->tokenUrl, [
                'grant_type'   => 'authorization_code',
                'code'         => $code,
                'redirect_uri' => $this->redirectUri,
            ])
            ->throw();

        $data = $response->json();
        $this->guard124($data);

        return $this->persistToken($data, $lifesycleUserId);
    }

    /**
     * Refresh access token using the stored refresh token.
     */
    public function refreshToken(ZoomOauthToken $token): ZoomOauthToken
    {
        try {
            $response = Http::withBasicAuth($this->clientId, $this->clientSecret)
                ->asForm()
                ->post($this->tokenUrl, [
                    'grant_type'    => 'refresh_token',
                    'refresh_token' => $token->refresh_token_enc,
                ])
                ->throw();
        } catch (RequestException $e) {
            if ($e->response?->status() === 401) {
                throw new ZoomReauthorizationRequiredException(
                    'Zoom refresh token is invalid or revoked. User must reconnect.',
                    0,
                    $e,
                );
            }

            throw $e;
        }

        $data = $response->json();
        $this->guard124($data);

        return $this->persistToken($data, $token->lifesycle_user_id, $token);
    }

    // Persist token encrypted in database
    private function persistToken(
        array $data,
        int $lifesycleUserId,
        ?ZoomOauthToken $existing = null,
    ): ZoomOauthToken {
        $profile = $this->fetchUserProfile($data['access_token']);

        $attributes = [
            'lifesycle_user_id' => $lifesycleUserId,
            'zoom_user_id'      => $profile['id'],
            'zoom_email'        => $profile['email'],
            'access_token_enc'  => $data['access_token'],
            'refresh_token_enc' => $data['refresh_token'],
            'scope'             => $data['scope'] ?? null,
            'expires_at'        => now()->addSeconds((int) ($data['expires_in'] ?? 3600)),
        ];

        if ($existing) {
            $existing->update($attributes);
            return $existing->fresh();
        }

        return ZoomOauthToken::updateOrCreate(
            ['zoom_user_id' => $profile['id']],
            $attributes,
        );
    }

    private function fetchUserProfile(string $accessToken): array
    {
        return Http::withToken($accessToken)
            ->get(config('zoom.api_base_url') . '/users/me')
            ->throw()
            ->json();
    }

    private function guard124(array $data): void
    {
        if (isset($data['code']) && (int) $data['code'] === 124) {
            throw new ZoomReauthorizationRequiredException();
        }
    }
}
