<?php

use App\Http\Controllers\Zoom\MeetingAuthController;
use App\Http\Controllers\Zoom\VideoSessionController;
use App\Http\Controllers\Zoom\WebhookController;
use Illuminate\Support\Facades\Route;

// Meeting SDK JWT signature endpoint for frontend join/host requests
Route::post('/zoom/meeting-auth', [MeetingAuthController::class, 'issue'])
    ->name('zoom.meeting-auth');

// Video SDK JWT token endpoint for video session join/host requests
Route::post('/zoom/token', [VideoSessionController::class, 'issue'])
    ->name('zoom.video.token');
Route::post('/zoom/video-token', [VideoSessionController::class, 'issue'])
    ->name('zoom.video-token');

// Zoom Webhook endpoint (CSRF exempt in bootstrap/app.php)
Route::post('/zoom/webhook', [WebhookController::class, 'handle'])
    ->name('zoom.webhook');
