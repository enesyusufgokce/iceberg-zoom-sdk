<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $event_type
 * @property string|null $zoom_object_id
 * @property array $payload
 * @property bool $signature_verified
 * @property \Carbon\Carbon|null $processed_at
 * @property \Carbon\Carbon $received_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ZoomWebhookEvent extends Model
{
    protected $table = 'zoom_webhook_events';

    protected $fillable = [
        'event_type',
        'zoom_object_id',
        'payload',
        'signature_verified',
        'processed_at',
        'received_at',
    ];

    protected $casts = [
        'payload'            => 'array',
        'signature_verified' => 'boolean',
        'processed_at'       => 'datetime',
        'received_at'        => 'datetime',
    ];
}
