<?php

namespace App\Repositories;

use App\Data\ReminderRuleInput;
use App\Models\ReminderRule;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Reminder rules by scope: a user's defaults ($subscriptionId null) or one subscription's own.
 */
interface ReminderRuleRepository
{
    /** @return Collection<int, ReminderRule> ordered by days_before */
    public function forScope(User $user, ?int $subscriptionId): Collection;

    /** Updates $existing in place (keeping its id), or creates a rule in the scope. */
    public function save(User $user, ?int $subscriptionId, ReminderRuleInput $input, ?ReminderRule $existing): ReminderRule;

    /** @param list<int> $keepIds */
    public function deleteInScopeExcept(User $user, ?int $subscriptionId, array $keepIds): void;
}
