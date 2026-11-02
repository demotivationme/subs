<?php

namespace App\Repositories;

use App\Data\SubscriptionChanges;
use App\Data\SubscriptionFilter;
use App\Data\SubscriptionInput;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Collection;

final class EloquentSubscriptionRepository implements SubscriptionRepository
{
    public function forUser(User $user, SubscriptionFilter $filter): Collection
    {
        return $user->subscriptions()
            ->with(['service', 'category'])
            ->when($filter->status, fn ($q, $status) => $q->where('status', $status))
            ->when($filter->categoryId, fn ($q, $id) => $q->where('category_id', $id))
            ->get();
    }

    public function activeForUser(User $user): Collection
    {
        return $user->subscriptions()
            ->where('status', SubscriptionStatus::Active)
            ->with(['service', 'category'])
            ->get();
    }

    public function allForUserWithHistory(User $user): Collection
    {
        return $user->subscriptions()
            ->with([
                'service',
                'category',
                'statusChanges' => fn ($q) => $q->orderBy('changed_at')->orderBy('id'),
            ])
            ->get();
    }

    public function countForUser(User $user): int
    {
        return $user->subscriptions()->count();
    }

    public function findForUserOrFail(User $user, int $id): Subscription
    {
        return $user->subscriptions()->with(['service', 'category'])->findOrFail($id);
    }

    public function findWithTrashed(int $id): ?Subscription
    {
        return Subscription::withTrashed()->find($id);
    }

    public function create(User $user, SubscriptionInput $input, int $serviceId, int $categoryId): Subscription
    {
        return $user->subscriptions()->create([
            'service_id' => $serviceId,
            'category_id' => $categoryId,
            'amount' => $input->amount,
            'currency' => $input->currency,
            'period' => $input->period,
            'interval_count' => $input->intervalCount,
            'first_payment_date' => $input->firstPaymentDate,
            'notes' => $input->notes,
            'reminders_enabled' => $input->remindersEnabled,
        ])->load(['service', 'category']);
    }

    public function update(Subscription $subscription, SubscriptionChanges $changes, ?int $serviceId): void
    {
        $attributes = $changes->attributes;
        if ($serviceId !== null) {
            $attributes['service_id'] = $serviceId;
        }

        $subscription->update($attributes);
        $subscription->refresh()->load(['service', 'category']);
    }

    public function delete(Subscription $subscription): void
    {
        $subscription->delete();
    }

    public function reassignCategory(int $fromCategoryId, int $toCategoryId): void
    {
        Subscription::withTrashed()->where('category_id', $fromCategoryId)->update(['category_id' => $toCategoryId]);
    }

    public function saveNextPaymentDate(Subscription $subscription): void
    {
        $subscription->save();
    }

    public function chunkActive(int $size, Closure $callback): void
    {
        Subscription::query()
            ->where('status', SubscriptionStatus::Active)
            ->with(['user.defaultReminderRules', 'reminderRules', 'service'])
            ->chunkById($size, $callback);
    }
}
