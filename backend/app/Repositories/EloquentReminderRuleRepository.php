<?php

namespace App\Repositories;

use App\Data\ReminderRuleInput;
use App\Models\ReminderRule;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class EloquentReminderRuleRepository implements ReminderRuleRepository
{
    public function forScope(User $user, ?int $subscriptionId): Collection
    {
        return $this->scope($user, $subscriptionId)->orderBy('days_before')->get();
    }

    public function save(User $user, ?int $subscriptionId, ReminderRuleInput $input, ?ReminderRule $existing): ReminderRule
    {
        $rule = $existing ?? $user->reminderRules()->make(['subscription_id' => $subscriptionId]);
        $rule->fill($input->toArray())->save();

        return $rule;
    }

    public function deleteInScopeExcept(User $user, ?int $subscriptionId, array $keepIds): void
    {
        $this->scope($user, $subscriptionId)->whereNotIn('id', $keepIds)->delete();
    }

    private function scope(User $user, ?int $subscriptionId): HasMany
    {
        return $user->reminderRules()->where('subscription_id', $subscriptionId);
    }
}
