<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubscriptionRequest;
use App\Http\Requests\SubscriptionIndexRequest;
use App\Http\Requests\UpdateSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SubscriptionController extends Controller
{
    public function __construct(private readonly SubscriptionService $subscriptions) {}

    public function index(SubscriptionIndexRequest $request): AnonymousResourceCollection
    {
        return SubscriptionResource::collection($this->subscriptions->list($request->user(), $request->toInput()));
    }

    public function store(StoreSubscriptionRequest $request): JsonResponse
    {
        $subscription = $this->subscriptions->create($request->user(), $request->toInput());

        return (new SubscriptionResource($subscription))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $subscription): SubscriptionResource
    {
        return new SubscriptionResource($this->subscriptions->find($request->user(), $subscription));
    }

    public function update(UpdateSubscriptionRequest $request, int $subscription): SubscriptionResource
    {
        return new SubscriptionResource($this->subscriptions->update($request->user(), $subscription, $request->toChanges()));
    }

    public function destroy(Request $request, int $subscription): Response
    {
        $this->subscriptions->delete($request->user(), $subscription);

        return response()->noContent();
    }
}
