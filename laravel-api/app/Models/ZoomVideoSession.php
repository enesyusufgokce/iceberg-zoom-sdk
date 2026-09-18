<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $session_name
 * @property int|null $crm_contact_id
 * @property int|null $property_id
 * @property string|null $user_key
 * @property string $status
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $ended_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ZoomVideoSession extends Model
{
    protected $table = 'zoom_video_sessions';

    protected $fillable = [
        'session_name',
        'crm_contact_id',
        'property_id',
        'user_key',
        'status',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at'   => 'datetime',
    ];
}
