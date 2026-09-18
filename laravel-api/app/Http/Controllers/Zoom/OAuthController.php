<?php

namespace App\Http\Controllers\Zoom;

use App\Http\Controllers\Controller;
use App\Services\Zoom\ZoomOAuthService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

// Handles Zoom OAuth 2.0 redirect and callback flow.
class OAuthController extends Controller
{
    public function __construct(private readonly ZoomOAuthService $oauthService) {}

    /**
     * Redirect user to Zoom OAuth consent screen.
     */
    public function redirect(Request $request): RedirectResponse
    {
        $lifesycleUserId = (int) $request->query('user_id', 1);

        ['url' => $consentUrl, 'state' => $state] =
            $this->oauthService->getAuthorizationUrl($lifesycleUserId);

        $request->session()->put('zoom_oauth_state', $state);

        return redirect()->away($consentUrl);
    }

    /**
     * Handle OAuth callback from Zoom.
     */
    public function callback(Request $request): RedirectResponse
    {
        $storedState = $request->session()->pull('zoom_oauth_state');

        if (! $storedState || ! hash_equals($storedState, (string) $request->query('state', ''))) {
            abort(422, 'Invalid OAuth state. Possible CSRF attempt.');
        }

        if ($request->has('error')) {
            return redirect()->to('/?zoom_error=' . urlencode((string) $request->query('error')));
        }

        $code = (string) $request->query('code', '');
        if (empty($code)) {
            abort(400, 'Authorization code missing from callback.');
        }

        $stateData       = json_decode(base64_decode($storedState ?? ''), true);
        $lifesycleUserId = (int) ($stateData['user_id'] ?? 1);

        $token = $this->oauthService->exchangeCodeForToken($code, $lifesycleUserId);

        return redirect()->to('/?zoom_connected=1&zoom_email=' . urlencode($token->zoom_email));
    }
}
