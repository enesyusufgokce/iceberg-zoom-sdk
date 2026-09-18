<?php

namespace App\Http\Controllers\Zoom;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessZoomWebhookEvent;
use App\Models\ZoomWebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

// Receives, verifies and persists incoming Zoom webhook events.
class WebhookController extends Controller
{
    /**
     * Handle incoming Zoom webhook event.
     */
    public function handle(Request $request): JsonResponse|Response
    {
        $timestamp = $request->header('x-zm-request-timestamp');
        $signature = $request->header('x-zm-signature');
        $rawBody   = $request->getContent();

        // Check timestamp freshness (replay attack protection)
        if (! $this->isTimestampFresh((int) $timestamp)) {
            Log::warning('[Zoom Webhook] Rejected stale timestamp', ['timestamp' => $timestamp]);
            return response('Request timestamp too old.', Response::HTTP_UNAUTHORIZED);
        }

        // Verify HMAC-SHA256 signature
        if (! $this->verifySignature($timestamp, $rawBody, $signature)) {
            Log::warning('[Zoom Webhook] Signature verification failed');
            return response('Invalid signature.', Response::HTTP_UNAUTHORIZED);
        }

        $payload   = json_decode($rawBody, true) ?? [];
        $eventType = $payload['event'] ?? 'unknown';

        // URL validation challenge from Zoom Marketplace
        if ($eventType === 'endpoint.url_validation') {
            return $this->handleUrlValidation($payload);
        }

        // Persist verified event
        $zoomObjectId = $payload['payload']['object']['id'] ?? null;

        $webhookEvent = ZoomWebhookEvent::create([
            'event_type'         => $eventType,
            'zoom_object_id'     => $zoomObjectId ? (string) $zoomObjectId : null,
            'payload'            => $payload,
            'signature_verified' => true,
            'received_at'        => now(),
        ]);

        // Queue asynchronous processing
        ProcessZoomWebhookEvent::dispatch($webhookEvent);

        return response()->json(['status' => 'accepted']);
    }

    // Verify x-zm-signature using HMAC-SHA256 and hash_equals
    private function verifySignature(
        string|int|null $timestamp,
        string $rawBody,
        ?string $receivedSignature,
    ): bool {
        if (empty($receivedSignature)) {
            return false;
        }

        $secret   = (string) config('zoom.webhook_secret_token');
        $message  = "v0:{$timestamp}:{$rawBody}";
        $expected = 'v0=' . hash_hmac('sha256', $message, $secret);

        return hash_equals($expected, $receivedSignature);
    }

    private function isTimestampFresh(int $timestamp): bool
    {
        $tolerance = (int) config('zoom.webhook_timestamp_tolerance', 300);
        return abs(time() - $timestamp) <= $tolerance;
    }

    // Respond to Zoom endpoint URL validation challenge
    private function handleUrlValidation(array $payload): JsonResponse
    {
        $plainToken     = $payload['payload']['plainToken'] ?? '';
        $secret         = (string) config('zoom.webhook_secret_token');
        $encryptedToken = hash_hmac('sha256', $plainToken, $secret);

        return response()->json([
            'plainToken'     => $plainToken,
            'encryptedToken' => $encryptedToken,
        ]);
    }
}
