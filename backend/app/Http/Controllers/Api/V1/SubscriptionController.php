<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubscriptionRequest;
use App\Http\Requests\UpdateSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Category;
use App\Models\Service;
use App\Services\ServiceResolver;
use App\Services\SpendCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class SubscriptionController extends Controller
{
    public function index(Request $request, SpendCalculator $spend): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(SubscriptionStatus::class)],
            'category_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['price', 'next_payment', 'name'])],
        ]);
        $user = $request->user();

        $subscriptions = $user->subscriptions()
            ->with(['service', 'category'])
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->input('category_id'), fn ($q, $id) => $q->where('category_id', $id))
            ->get();

        $sorted = match ($request->input('sort', 'next_payment')) {
            'price' => $subscriptions->sortByDesc(fn ($s) => $spend->monthlyIn($s, $user->currency) ?? -1),
            'name' => $subscriptions->sortBy(fn ($s) => mb_strtolower($s->service->name)),
            default => $subscriptions->sortBy(fn ($s) => $s->next_payment_date->toDateString()),
        };

        return SubscriptionResource::collection($sorted->values());
    }

    public function store(StoreSubscriptionRequest $request, ServiceResolver $resolver): JsonResponse
    {
        $user = $request->user();
        $limit = config('subs.free_subscription_limit');
        abort_if(
            $limit !== null && ! $user->is_premium && $user->subscriptions()->count() >= $limit,
            403,
            __('subscriptions.limit_reached', ['limit' => $limit]),
        );

        $data = $request->validated();
        $service = $this->service($request, $resolver, $data);

        $subscription = $user->subscriptions()->create([
            ...Arr::except($data, ['service_id', 'service_name']),
            'service_id' => $service->id,
            'category_id' => $data['category_id'] ?? $service->default_category_id ?? Category::other()->id,
        ]);

        return (new SubscriptionResource($subscription->load(['service', 'category'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $subscription): SubscriptionResource
    {
        return new SubscriptionResource($request->user()->subscriptions()->with(['service', 'category'])->findOrFail($subscription));
    }

    public function update(UpdateSubscriptionRequest $request, ServiceResolver $resolver, int $subscription): SubscriptionResource
    {
        $model = $request->user()->subscriptions()->findOrFail($subscription);
        $data = $request->validated();

        if (isset($data['service_id']) || isset($data['service_name'])) {
            $data['service_id'] = $this->service($request, $resolver, $data)->id;
        }

        $model->update(Arr::except($data, ['service_name']));

        return new SubscriptionResource($model->refresh()->load(['service', 'category']));
    }

    public function destroy(Request $request, int $subscription): Response
    {
        $request->user()->subscriptions()->findOrFail($subscription)->delete();

        return response()->noContent();
    }

    private function service(Request $request, ServiceResolver $resolver, array $data): Service
    {
        return isset($data['service_id'])
            ? Service::findOrFail($data['service_id'])
            : $resolver->resolve($request->user(), $data['service_name']);
    }
}
