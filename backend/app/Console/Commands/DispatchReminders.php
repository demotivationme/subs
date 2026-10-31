<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\ReminderRule;
use App\Models\SentReminder;
use App\Models\Subscription;
use App\Notifications\PaymentReminder;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class DispatchReminders extends Command
{
    public const HEARTBEAT_KEY = 'reminders:heartbeat';

    protected $signature = 'reminders:dispatch';

    protected $description = 'Advance payment dates and queue payment reminders that are due';

    public function handle(): int
    {
        $now = CarbonImmutable::now();
        $queued = 0;

        Subscription::query()
            ->where('status', SubscriptionStatus::Active)
            ->with(['user.defaultReminderRules', 'reminderRules', 'service'])
            ->chunkById(500, function (Collection $subscriptions) use ($now, &$queued) {
                foreach ($subscriptions as $subscription) {
                    $this->advance($subscription);

                    foreach ($subscription->effectiveReminderRules() as $rule) {
                        $queued += $this->remind($subscription, $rule, $now);
                    }
                }
            });

        Cache::forever(self::HEARTBEAT_KEY, $now->getTimestamp());
        $this->info("Queued {$queued} reminder(s).");

        return self::SUCCESS;
    }

    private function advance(Subscription $subscription): void
    {
        $today = $subscription->user->today();

        if ($subscription->next_payment_date->lt($today)) {
            $subscription->next_payment_date = BillingCycle::nextOnOrAfter(
                $subscription->first_payment_date, $subscription->period, $subscription->interval_count, $today,
            );
            $subscription->save();
        }
    }

    /**
     * A reminder is due when (payment date − days_before) at time_of_day, in the user's
     * timezone, lies in (now − 24h, now]. Such a moment falls on the user's local today
     * or yesterday, so only two candidate payment dates need checking.
     */
    private function remind(Subscription $subscription, ReminderRule $rule, CarbonImmutable $now): int
    {
        $user = $subscription->user;
        $today = $user->today();
        $queued = 0;

        foreach ([$today, $today->subDay()] as $momentDate) {
            $paymentDate = $momentDate->addDays($rule->days_before);

            if ($paymentDate->lt($today) || ! $subscription->isOccurrence($paymentDate)) {
                continue;
            }

            $moment = CarbonImmutable::parse($momentDate->toDateString().' '.$rule->time_of_day, $user->timezone);
            if ($moment->lte($now->subDay()) || $moment->gt($now)) {
                continue;
            }

            $inserted = SentReminder::query()->insertOrIgnore([
                'subscription_id' => $subscription->id,
                'reminder_rule_id' => $rule->id,
                'payment_date' => $paymentDate->toDateString(),
            ]);

            if ($inserted === 1) {
                $user->notify(new PaymentReminder($subscription, $rule, $paymentDate));
                $queued++;
            }
        }

        return $queued;
    }
}
