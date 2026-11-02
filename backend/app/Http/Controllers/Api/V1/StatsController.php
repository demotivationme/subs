<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StatsRequest;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __invoke(StatsRequest $request, StatsService $stats): JsonResponse
    {
        return response()->json($stats->for($request->user(), $request->toQuery()));
    }
}
