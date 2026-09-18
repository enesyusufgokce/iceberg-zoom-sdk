<?php

use App\Http\Controllers\Zoom\MeetingAuthController;
use App\Http\Controllers\Zoom\OAuthController;
use App\Http\Controllers\Zoom\VideoSessionController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Fallback aliases for root paths
Route::post('/jwt', [MeetingAuthController::class, 'issue']);
Route::post('/token', [VideoSessionController::class, 'issue']);

// Zoom OAuth 2.0 authorization code flow routes
Route::prefix('zoom/oauth')->name('zoom.oauth.')->group(function () {
    Route::get('/redirect', [OAuthController::class, 'redirect'])->name('redirect');
    Route::get('/callback', [OAuthController::class, 'callback'])->name('callback');
});
