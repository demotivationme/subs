<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\WebPushSubscribeRequest;
use App\Http\Requests\WebPushUnsubscribeRequest;
use App\Services\DeviceService;
use Illuminate\Http\Response;

class WebPushController extends Controller
{
    public function __construct(private readonly DeviceService $devices) {}

    public function store(WebPushSubscribeRequest $request): Response
    {
        $this->devices->subscribeWebPush($request->user(), $request->toInput());

        return response()->noContent();
    }

    public function destroy(WebPushUnsubscribeRequest $request): Response
    {
        $this->devices->unsubscribeWebPush($request->user(), $request->endpoint());

        return response()->noContent();
    }
}
