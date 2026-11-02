<?php

namespace App\Repositories;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use Carbon\CarbonImmutable;

/** The history of when each subscription became active, paused or cancelled. */
interface SubscriptionStatusChangeRepository
{
    public function record(Subscription $subscription, SubscriptionStatus $status, CarbonImmutable $at): void;
}
