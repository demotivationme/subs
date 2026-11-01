<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceRequest;
use App\Services\DeviceService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class DeviceController extends Controller
{
    public function __construct(private readonly DeviceService $devices) {}

    public function store(DeviceRequest $request): Response
    {
        $this->devices->register($request->user(), $request->toInput());

        return response()->noContent();
    }

    public function destroy(Request $request, string $token): Response
    {
        $this->devices->forget($request->user(), $token);

        return response()->noContent();
    }
}
