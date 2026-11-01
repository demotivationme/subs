<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class ReminderRuleSync
{
    /**
     * Replaces the rules of one scope (user defaults when $subscription is null).
     * Rules are matched by days_before and updated in place, so their ids survive an edit.
     * (sent_reminders dedupes by days_before, so even a replaced rule does not resend.)
     *
     * @param  list<array{days_before:int, time_of_day:string, channels:list<string>}>  $rules
     */
    public function sync(User $user, ?Subscription $subscription, array $rules): Collection
    {
        return DB::transaction(function () use ($user, $subscription, $rules) {
            $scope = fn () => $user->reminderRules()->where('subscription_id', $subscription?->id);
            $existing = $scope()->get()->keyBy('days_before');
            $keep = [];

            foreach ($rules as $data) {
                $rule = $existing->get($data['days_before'])
                    ?? $user->reminderRules()->make(['subscription_id' => $subscription?->id]);
                $rule->fill($data)->save();
                $keep[] = $rule->id;
            }

            $scope()->whereNotIn('id', $keep)->delete();

            return $scope()->orderBy('days_before')->get();
        });
    }
}
