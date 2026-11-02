<?php

namespace App\Repositories;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\SubscriptionStatusChange;
use Carbon\CarbonImmutable;

final class EloquentSubscriptionStatusChangeRepository implements SubscriptionStatusChangeRepository
{
    public function record(Subscription $subscription, SubscriptionStatus $status, CarbonImmutable $at): void
    {
        SubscriptionStatusChange::query()->create([
            'subscription_id' => $subscription->id,
            'status' => $status,
            'changed_at' => $at,
        ]);
    }
}
