<?php

use App\Http\Controllers\Zoom\OAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Zoom OAuth 2.0 authorization code flow routes
Route::prefix('zoom/oauth')->name('zoom.oauth.')->group(function () {
    Route::get('/redirect', [OAuthController::class, 'redirect'])->name('redirect');
    Route::get('/callback', [OAuthController::class, 'callback'])->name('callback');
});
