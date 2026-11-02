<?php

namespace App\Repositories;

use App\Data\SubscriptionChanges;
use App\Data\SubscriptionFilter;
use App\Data\SubscriptionInput;
use App\Models\Subscription;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Collection;

/** Users' subscriptions (soft-deleted ones are hidden unless a method says otherwise). */
interface SubscriptionRepository
{
    /** @return Collection<int, Subscription> unsorted, with service and category */
    public function forUser(User $user, SubscriptionFilter $filter): Collection;

    /** @return Collection<int, Subscription> active ones, with service and category */
    public function activeForUser(User $user): Collection;

    /** @return Collection<int, Subscription> every one (any status), with service, category and status changes oldest first */
    public function allForUserWithHistory(User $user): Collection;

    public function countForUser(User $user): int;

    /** One of the user's own, with service and category; 404 otherwise. */
    public function findForUserOrFail(User $user, int $id): Subscription;

    /** Includes soft-deleted rows. */
    public function findWithTrashed(int $id): ?Subscription;

    public function create(User $user, SubscriptionInput $input, int $serviceId, int $categoryId): Subscription;

    public function update(Subscription $subscription, SubscriptionChanges $changes, ?int $serviceId): void;

    public function delete(Subscription $subscription): void;

    /** Moves every subscription in $fromCategoryId, soft-deleted ones included, to $toCategoryId. */
    public function reassignCategory(int $fromCategoryId, int $toCategoryId): void;

    /** Saves a recomputed next_payment_date. */
    public function saveNextPaymentDate(Subscription $subscription): void;

    /**
     * Every active subscription in id-ordered chunks, with user defaults, own rules and service loaded.
     *
     * @param  Closure(Collection<int, Subscription>): void  $callback
     */
    public function chunkActive(int $size, Closure $callback): void;
}
