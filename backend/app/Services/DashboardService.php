<?php

namespace App\Services;

use App\Models\User;

final class DashboardService
{
    public function __construct(private readonly SpendCalculator $spend) {}

    public function for(User $user): array
    {
        return DashboardCache::remember($user, fn () => $this->spend->dashboard($user));
    }
}
