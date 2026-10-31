<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DashboardCache;
use App\Services\SpendCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, SpendCalculator $spend): JsonResponse
    {
        $user = $request->user();

        return response()->json(DashboardCache::remember($user, fn () => $spend->dashboard($user)));
    }
}
