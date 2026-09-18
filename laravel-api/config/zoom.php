<?php

return [
    // Zoom Meeting SDK Credentials
    'sdk_client_id'     => env('ZOOM_SDK_CLIENT_ID'),
    'sdk_client_secret' => env('ZOOM_SDK_CLIENT_SECRET'),

    // Zoom Video SDK Credentials
    'video_sdk_key'     => env('ZOOM_VIDEO_SDK_KEY'),
    'video_sdk_secret'  => env('ZOOM_VIDEO_SDK_SECRET'),

    // Zoom OAuth Credentials
    'oauth_client_id'     => env('ZOOM_OAUTH_CLIENT_ID'),
    'oauth_client_secret' => env('ZOOM_OAUTH_CLIENT_SECRET'),
    'oauth_redirect_uri'  => env('ZOOM_OAUTH_REDIRECT_URI'),

    // Zoom Webhook Secret Token
    'webhook_secret_token' => env('ZOOM_WEBHOOK_SECRET_TOKEN'),

    // Zoom API Endpoints
    'api_base_url'    => 'https://api.zoom.us/v2',
    'oauth_token_url' => 'https://zoom.us/oauth/token',

    // Meeting SDK JWT TTL (seconds, Zoom requires 1800-172800)
    'sdk_jwt_ttl' => (int) env('ZOOM_SDK_JWT_TTL', 7200),

    // Webhook Replay Protection Window (seconds)
    'webhook_timestamp_tolerance' => (int) env('ZOOM_WEBHOOK_TIMESTAMP_TOLERANCE', 300),
];
