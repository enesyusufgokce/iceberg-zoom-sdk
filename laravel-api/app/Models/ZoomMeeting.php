<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $oauth_token_id
 * @property int|null $crm_contact_id
 * @property int|null $property_id
 * @property string $zoom_meeting_id
 * @property string|null $zoom_meeting_uuid
 * @property string $topic
 * @property string $status
 * @property \Carbon\Carbon|null $start_time
 * @property string|null $join_url
 * @property string|null $recording_url
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ZoomMeeting extends Model
{
    protected $table = 'zoom_meetings';

    protected $fillable = [
        'oauth_token_id',
        'crm_contact_id',
        'property_id',
        'zoom_meeting_id',
        'zoom_meeting_uuid',
        'topic',
        'status',
        'start_time',
        'join_url',
        'recording_url',
    ];

    protected $casts = [
        'start_time' => 'datetime',
    ];

    public function oauthToken(): BelongsTo
    {
        return $this->belongsTo(ZoomOauthToken::class, 'oauth_token_id');
    }
}
