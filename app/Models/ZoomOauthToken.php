<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $lifesycle_user_id
 * @property string $zoom_user_id
 * @property string $zoom_email
 * @property string $access_token_enc
 * @property string $refresh_token_enc
 * @property string|null $scope
 * @property \Carbon\Carbon $expires_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class ZoomOauthToken extends Model
{
    protected $table = 'zoom_oauth_tokens';

    protected $fillable = [
        'lifesycle_user_id',
        'zoom_user_id',
        'zoom_email',
        'access_token_enc',
        'refresh_token_enc',
        'scope',
        'expires_at',
    ];

    // Encrypted with APP_KEY (AES-256-CBC)
    protected $casts = [
        'access_token_enc'  => 'encrypted',
        'refresh_token_enc' => 'encrypted',
        'expires_at'        => 'datetime',
    ];

    // Prevent tokens from serializing into arrays/JSON
    protected $hidden = [
        'access_token_enc',
        'refresh_token_enc',
    ];

    // Checks expiration with a 60-second clock skew buffer
    public function isExpired(): bool
    {
        return $this->expires_at->subSeconds(60)->isPast();
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(ZoomMeeting::class, 'oauth_token_id');
    }
}
