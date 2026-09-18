<?php

namespace App\Jobs;

use App\Models\ZoomWebhookEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

// Processes a verified Zoom webhook event asynchronously.
class ProcessZoomWebhookEvent implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public int $backoff = 10;

    public function __construct(public readonly ZoomWebhookEvent $webhookEvent) {}

    public function handle(): void
    {
        $eventType = $this->webhookEvent->event_type;
        $payload   = $this->webhookEvent->payload;

        Log::info('[Zoom Webhook] Processing event', [
            'event_type' => $eventType,
            'webhook_id' => $this->webhookEvent->id,
        ]);

        match ($eventType) {
            'meeting.started'     => $this->onMeetingStarted($payload),
            'meeting.ended'       => $this->onMeetingEnded($payload),
            'recording.completed' => $this->onRecordingCompleted($payload),
            default               => $this->onUnhandledEvent($eventType, $payload),
        };

        $this->webhookEvent->update(['processed_at' => now()]);
    }

    private function onMeetingStarted(array $payload): void
    {
        // TODO: Update zoom_meetings.status to 'started'
        Log::info('[Zoom Webhook] meeting.started', ['object' => $payload['object'] ?? []]);
    }

    private function onMeetingEnded(array $payload): void
    {
        // TODO: Update zoom_meetings.status to 'ended'
        Log::info('[Zoom Webhook] meeting.ended', ['object' => $payload['object'] ?? []]);
    }

    private function onRecordingCompleted(array $payload): void
    {
        // TODO: Persist recording URL to zoom_meetings.recording_url
        Log::info('[Zoom Webhook] recording.completed', ['object' => $payload['object'] ?? []]);
    }

    private function onUnhandledEvent(string $eventType, array $payload): void
    {
        Log::debug('[Zoom Webhook] Unhandled event type', ['event_type' => $eventType]);
    }
}
