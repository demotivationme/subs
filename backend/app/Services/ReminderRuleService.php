<?php

namespace App\Services;

use App\Data\ReminderRuleInput;
use App\Models\ReminderRule;
use App\Models\User;
use App\Repositories\ReminderRuleRepository;
use App\Repositories\SubscriptionRepository;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;
use Illuminate\Database\Eloquent\Collection;

/** A user's default reminder rules and per-subscription overrides (empty = use the defaults). */
final class ReminderRuleService
{
    public function __construct(
        private readonly ReminderRuleRepository $rules,
        private readonly SubscriptionRepository $subscriptions,
        private readonly UserRepository $users,
        private readonly TransactionRunner $transactions,
    ) {}

    /** @return Collection<int, ReminderRule> */
    public function defaults(User $user): Collection
    {
        return $this->rules->forScope($user, null);
    }

    /**
     * @param  list<ReminderRuleInput>  $rules
     * @return Collection<int, ReminderRule>
     */
    public function replaceDefaults(User $user, array $rules): Collection
    {
        return $this->replace($user, null, $rules);
    }

    /** @return Collection<int, ReminderRule> */
    public function forSubscription(User $user, int $subscriptionId): Collection
    {
        return $this->rules->forScope($user, $this->subscriptions->findForUserOrFail($user, $subscriptionId)->id);
    }

    /**
     * @param  list<ReminderRuleInput>  $rules
     * @return Collection<int, ReminderRule>
     */
    public function replaceForSubscription(User $user, int $subscriptionId, array $rules): Collection
    {
        return $this->replace($user, $this->subscriptions->findForUserOrFail($user, $subscriptionId)->id, $rules);
    }

    /**
     * Replaces the rules of one scope. Rules are matched by days_before and updated in place,
     * so their ids survive an edit. (sent_reminders dedupes by days_before, so even a replaced
     * rule does not resend.)
     *
     * @param  list<ReminderRuleInput>  $rules
     * @return Collection<int, ReminderRule>
     */
    private function replace(User $user, ?int $subscriptionId, array $rules): Collection
    {
        return $this->transactions->run(function () use ($user, $subscriptionId, $rules) {
            // Serializes concurrent PUTs for this user; the unique index is the backstop.
            $this->users->lock($user);

            $existing = $this->rules->forScope($user, $subscriptionId)->keyBy('days_before');
            $keep = [];

            foreach ($rules as $input) {
                $keep[] = $this->rules->save($user, $subscriptionId, $input, $existing->get($input->daysBefore))->id;
            }

            $this->rules->deleteInScopeExcept($user, $subscriptionId, $keep);

            return $this->rules->forScope($user, $subscriptionId);
        });
    }
}
