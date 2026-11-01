<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $inbox) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return NotificationResource::collection($this->inbox->page($request->user()));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->inbox->unreadCount($request->user())]);
    }

    public function read(Request $request, string $id): Response
    {
        $this->inbox->markRead($request->user(), $id);

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $this->inbox->markAllRead($request->user());

        return response()->noContent();
    }
}
