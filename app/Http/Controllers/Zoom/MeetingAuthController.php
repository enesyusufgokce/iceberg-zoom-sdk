<?php

namespace App\Http\Controllers\Zoom;

use App\Http\Controllers\Controller;
use App\Services\Zoom\ZoomJwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Issues Meeting SDK JWT signatures for frontend join/host requests.
class MeetingAuthController extends Controller
{
    public function __construct(private readonly ZoomJwtService $jwtService) {}

    /**
     * Issue Meeting SDK signature.
     */
    public function issue(Request $request): JsonResponse
    {
        // Support both snake_case and camelCase (zoom-msdk-poc uses meetingNumber)
        $meetingNumber = $request->input('meeting_number') ?? $request->input('meetingNumber');
        $role          = $request->input('role', 0);

        if (empty($meetingNumber)) {
            return response()->json(['error' => 'meeting_number or meetingNumber is required.'], 422);
        }

        if (! in_array((int) $role, [0, 1], true)) {
            return response()->json(['error' => 'role must be 0 (attendee) or 1 (host).'], 422);
        }

        $signature = $this->jwtService->generate(
            meetingNumber: (string) $meetingNumber,
            role:          (int) $role,
        );

        return response()->json([
            'signature' => $signature,
            'sdkKey'    => config('zoom.sdk_client_id'),
        ]);
    }
}
