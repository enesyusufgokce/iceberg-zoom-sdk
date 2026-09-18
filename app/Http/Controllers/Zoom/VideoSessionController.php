<?php

namespace App\Http\Controllers\Zoom;

use App\Http\Controllers\Controller;
use App\Models\ZoomVideoSession;
use App\Services\Zoom\ZoomJwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

// Issues Video SDK JWT tokens for video session join/host requests.
class VideoSessionController extends Controller
{
    public function __construct(private readonly ZoomJwtService $jwtService) {}

    /**
     * Issue Video SDK token for a session.
     */
    public function issue(Request $request): JsonResponse
    {
        $sessionName = $request->input('sessionName') ?? $request->input('session_name');
        $role        = (int) $request->input('role', 1);

        if (empty($sessionName)) {
            return response()->json(['error' => 'sessionName or session_name is required.'], 422);
        }

        $token = $this->jwtService->generateVideoToken($sessionName, $role);

        // Best effort to track session in database
        try {
            ZoomVideoSession::updateOrCreate(
                ['session_name' => $sessionName],
                ['status' => 'waiting']
            );
        } catch (Throwable) {
            // Silently proceed if DB is not reachable in local dev
        }

        return response()->json([
            'token'       => $token,
            'sessionName' => $sessionName,
        ]);
    }
}
