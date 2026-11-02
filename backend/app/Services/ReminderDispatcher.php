<?php

namespace App\Services;

use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Notifications\PaymentReminder;
use App\Repositories\SentReminderRepository;
use App\Repositories\SubscriptionRepository;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Throwable;

/** Advances overdue payment dates and queues the payment reminders that are due. */
final class ReminderDispatcher
{
    public function __construct(
        private readonly SubscriptionRepository $subscriptions,
        private readonly SentReminderRepository $sent,
    ) {}

    /** @return int reminders queued */
    public function dispatch(CarbonImmutable $now): int
    {
        $queued = 0;

        $this->subscriptions->chunkActive(500, function (Collection $subscriptions) use ($now, &$queued) {
            foreach ($subscriptions as $subscription) {
                try {
                    $this->advance($subscription);

                    // Disabled subscriptions are still advanced above, just never reminded.
                    if (! $subscription->reminders_enabled) {
                        continue;
                    }

                    foreach ($subscription->effectiveReminderRules() as $rule) {
                        $queued += $this->remind($subscription, $rule, $now);
                    }
                } catch (Throwable $e) {
                    // One bad row must not stall the whole run.
                    report($e);
                }
            }
        });

        return $queued;
    }

    private function advance(Subscription $subscription): void
    {
        $today = $subscription->user->today();

        if ($subscription->next_payment_date->lt($today)) {
            $subscription->next_payment_date = BillingCycle::nextOnOrAfter(
                $subscription->first_payment_date, $subscription->period, $subscription->interval_count, $today,
            );
            $this->subscriptions->saveNextPaymentDate($subscription);
        }
    }

    /**
     * A reminder is due when (payment date − days_before) at time_of_day, in the user's
     * timezone, lies in (now − 24h, now]. Across a DST spring-forward 24 elapsed hours span
     * 25 wall-clock hours, so such a moment can fall on the local day before yesterday:
     * three candidate dates are checked. The window and the dedupe table keep it exact.
     * Dedupe is keyed by (subscription, payment date, days_before), not by rule id, so a
     * replaced or reverted rule with the same lead time does not resend.
     * The payment date may already be in the past (e.g. a same-day rule that fires just
     * after midnight local time), so it is not bounded by today.
     */
    private function remind(Subscription $subscription, ReminderRule $rule, CarbonImmutable $now): int
    {
        $user = $subscription->user;
        $today = $user->today();
        $queued = 0;

        foreach ([$today, $today->subDay(), $today->subDays(2)] as $momentDate) {
            $paymentDate = $momentDate->addDays($rule->days_before);

            if (! $subscription->isOccurrence($paymentDate)) {
                continue;
            }

            $moment = CarbonImmutable::parse($momentDate->toDateString().' '.$rule->time_of_day, $user->timezone);
            if ($moment->lte($now->subDay()) || $moment->gt($now)) {
                continue;
            }

            if ($this->sent->record($subscription->id, $rule->id, $paymentDate, $rule->days_before)) {
                $user->notify(new PaymentReminder($subscription, $rule, $paymentDate));
                $queued++;
            }
        }

        return $queued;
    }
}
