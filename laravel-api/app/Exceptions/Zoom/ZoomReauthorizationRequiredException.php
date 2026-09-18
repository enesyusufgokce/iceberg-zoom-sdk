<?php

namespace App\Exceptions\Zoom;

use RuntimeException;

// Thrown when Zoom token is invalid/revoked (HTTP 124) requiring re-authentication.
class ZoomReauthorizationRequiredException extends RuntimeException
{
    public function __construct(
        string $message = 'Zoom account must be reconnected. Please re-authorize via /zoom/oauth/redirect.',
        int $code = 0,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
