<?php

namespace App\Services;

use App\Data\StatsQuery;
use App\Models\User;
use App\Repositories\SubscriptionRepository;

final class StatsService
{
    public function __construct(
        private readonly SubscriptionRepository $subscriptions,
        private readonly StatsCalculator $calculator,
    ) {}

    public function for(User $user, StatsQuery $query): array
    {
        return $this->calculator->calculate($user, $this->subscriptions->allForUserWithHistory($user), $query);
    }
}
