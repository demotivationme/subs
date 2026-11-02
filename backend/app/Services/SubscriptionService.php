<?php

namespace App\Services;

use App\Data\SubscriptionChanges;
use App\Data\SubscriptionFilter;
use App\Data\SubscriptionInput;
use App\Exceptions\SubscriptionLimitReached;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Repositories\CategoryRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\SubscriptionRepository;
use App\Repositories\SubscriptionStatusChangeRepository;
use App\Repositories\TransactionRunner;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class SubscriptionService
{
    public function __construct(
        private readonly SubscriptionRepository $subscriptions,
        private readonly ServiceRepository $services,
        private readonly CategoryRepository $categories,
        private readonly ServiceResolver $resolver,
        private readonly SpendCalculator $spend,
        private readonly SubscriptionStatusChangeRepository $statusChanges,
        private readonly TransactionRunner $transactions,
    ) {}

    /** @return Collection<int, Subscription> sorted as $filter->sort asks */
    public function list(User $user, SubscriptionFilter $filter): Collection
    {
        $subscriptions = $this->subscriptions->forUser($user, $filter);

        $sorted = match ($filter->sort) {
            'price' => $subscriptions->sortByDesc(fn ($s) => $this->spend->monthlyIn($s, $user->currency) ?? -1),
            'name' => $subscriptions->sortBy(fn ($s) => mb_strtolower($s->service->name)),
            default => $subscriptions->sortBy(fn ($s) => $s->next_payment_date->toDateString()),
        };

        return $sorted->values()->toBase();
    }

    /**
     * Without a category the subscription takes its service's default, else "Other".
     *
     * @throws SubscriptionLimitReached for a free account at the limit
     */
    public function create(User $user, SubscriptionInput $input): Subscription
    {
        $limit = config('subs.free_subscription_limit');
        if ($limit !== null && ! $user->is_premium && $this->subscriptions->countForUser($user) >= $limit) {
            throw new SubscriptionLimitReached($limit);
        }

        $service = $this->service($user, $input->serviceId, $input->serviceName);
        $categoryId = $input->categoryId ?? $service->default_category_id ?? $this->categories->other()->id;

        return $this->transactions->run(function () use ($user, $input, $service, $categoryId) {
            $subscription = $this->subscriptions->create($user, $input, $service->id, $categoryId);
            $this->statusChanges->record($subscription, $subscription->status, CarbonImmutable::now());

            return $subscription;
        });
    }

    public function find(User $user, int $id): Subscription
    {
        return $this->subscriptions->findForUserOrFail($user, $id);
    }

    /** Changing the service keeps the category unless the category is changed too. */
    public function update(User $user, int $id, SubscriptionChanges $changes): Subscription
    {
        $subscription = $this->subscriptions->findForUserOrFail($user, $id);
        $serviceId = $changes->changesService()
            ? $this->service($user, $changes->serviceId, $changes->serviceName)->id
            : null;

        $before = $subscription->status;

        $this->transactions->run(function () use ($subscription, $changes, $serviceId, $before) {
            $this->subscriptions->update($subscription, $changes, $serviceId);

            if ($subscription->status !== $before) {
                $this->statusChanges->record($subscription, $subscription->status, CarbonImmutable::now());
            }
        });

        return $subscription;
    }

    public function delete(User $user, int $id): void
    {
        $this->subscriptions->delete($this->subscriptions->findForUserOrFail($user, $id));
    }

    private function service(User $user, ?int $serviceId, ?string $serviceName): Service
    {
        return $serviceId !== null
            ? $this->services->findOrFail($serviceId)
            : $this->resolver->resolve($user, $serviceName);
    }
}
