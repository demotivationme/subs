<?php

namespace App\Services;

use App\Data\StatsQuery;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Pure statistics over subscriptions that already carry service, category and status changes.
 *
 * Rules: a subscription is paying on a date when its status then (latest change on or before that
 * calendar day in the user's timezone) is active, and counts as active before its first recorded change.
 * An occurrence exactly on the day of a pause or cancel is therefore saved, not paid; one on the day of
 * a resume is paid. Amounts are converted at current rates; subscriptions without a rate are left out of
 * every sum and listed in `unconverted`.
 */
final class StatsCalculator
{
    public function __construct(
        private readonly CurrencyConverter $converter,
        private readonly SpendCalculator $spend,
        private readonly ServiceLogoStorage $logos,
    ) {}

    /** @param Collection<int, Subscription> $subscriptions */
    public function calculate(User $user, Collection $subscriptions, StatsQuery $query): array
    {
        $currency = $user->currency;
        $today = $user->today();
        $timezone = $user->timezone;
        $yearStart = CarbonImmutable::parse("{$query->year}-01-01");
        $yearEnd = CarbonImmutable::parse("{$query->year}-12-31");
        $lastMonthEnd = $today->startOfMonth()->subDay();
        $horizon = $today->addMonthsNoOverflow(12);

        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $months[$m] = ['month' => $m, 'paid' => 0.0, 'expected' => 0.0];
        }

        $payments = [];
        $unconverted = [];
        $savingItems = [];
        $savingMonthly = 0.0;
        $categories = [];
        $biggest = null;
        $next12 = 0.0;

        foreach ($subscriptions as $subscription) {
            $timeline = $this->timeline($subscription, $timezone);
            $isActive = $subscription->status === SubscriptionStatus::Active;
            $first = $subscription->first_payment_date;
            $period = $subscription->period;
            $interval = $subscription->interval_count;
            $monthly = $this->spend->monthlyIn($subscription, $currency);
            $convert = fn (float|int $minor): ?float => $this->converter->convert((float) $minor, $subscription->currency, $currency);
            $amount = $convert($subscription->amount);

            if ($amount === null) {
                $unconverted[$subscription->id] = ['subscription_id' => $subscription->id, 'currency' => $subscription->currency];
            }

            // Paid and expected occurrences in the requested year, and the month's payment list.
            foreach ($this->occurrences($subscription, $yearStart, $yearEnd) as $date) {
                $state = $date->lte($today)
                    ? ($this->statusAt($timeline, $date) === SubscriptionStatus::Active ? 'paid' : null)
                    : ($isActive ? 'expected' : null);

                if ($state === null) {
                    continue;
                }

                if ($amount !== null) {
                    $months[$date->month][$state] += $amount;
                }

                if ($query->month === $date->month) {
                    $payments[] = [
                        'subscription_id' => $subscription->id,
                        'name' => $subscription->service->name,
                        'date' => $date->toDateString(),
                        'amount' => $subscription->amount,
                        'currency' => $subscription->currency,
                        'converted' => $amount === null ? null : (int) round($amount),
                        'state' => $state,
                    ];
                }
            }

            // Savings: every occurrence up to today that fell in a paused or cancelled period.
            $saved = 0.0;
            $since = null;
            $until = null;
            foreach ($timeline as $i => $change) {
                $wasActive = $i === 0 || $timeline[$i - 1]['status'] === SubscriptionStatus::Active;
                if ($change['status'] !== SubscriptionStatus::Active && $wasActive) {
                    $since = $change['date'];
                    $until = null;
                } elseif ($change['status'] === SubscriptionStatus::Active && $since !== null && $until === null && ! $wasActive) {
                    $until = $change['date'];
                }
            }
            if ($since !== null && $amount !== null) {
                foreach ($this->occurrences($subscription, $first, $today) as $date) {
                    if ($this->statusAt($timeline, $date) !== SubscriptionStatus::Active) {
                        $saved += $amount;
                    }
                }
            }

            if ($saved > 0 || ! $isActive) {
                $savingItems[] = [
                    'subscription_id' => $subscription->id,
                    'name' => $subscription->service->name,
                    'service' => [
                        'id' => $subscription->service->id,
                        'name' => $subscription->service->name,
                        'logo_url' => $this->logos->url($subscription->service->logo_path),
                        'color' => $subscription->service->color,
                    ],
                    'status' => $subscription->status->value,
                    // How the latest inactive period began; a resumed subscription is active again by now.
                    'inactive_status' => ($isActive && $since !== null ? $this->statusAt($timeline, $since) : $subscription->status)->value,
                    'until' => $isActive ? $until?->toDateString() : null,
                    'since' => $since?->toDateString() ?? $subscription->updated_at?->setTimezone($timezone)->toDateString(),
                    'monthly' => (int) round($monthly ?? 0),
                    'saved' => (int) round($saved),
                ];
            }

            if ($monthly === null) {
                continue;
            }

            if (! $isActive) {
                $savingMonthly += $monthly;
            }

            // By category: now versus the end of last month.
            $label = $subscription->category->label();
            $categories[$subscription->category_id] ??= ['category_id' => $subscription->category_id, 'label' => $label, 'now' => 0.0, 'before' => 0.0];
            if ($isActive) {
                $categories[$subscription->category_id]['now'] += $monthly;
            }
            if ($first->lte($lastMonthEnd) && $this->statusAt($timeline, $lastMonthEnd) === SubscriptionStatus::Active) {
                $categories[$subscription->category_id]['before'] += $monthly;
            }

            if ($isActive && ($biggest === null || $monthly > $biggest['monthly'])) {
                $biggest = ['subscription_id' => $subscription->id, 'name' => $subscription->service->name, 'monthly' => $monthly];
            }
        }

        // Next 12 months: tomorrow through today + 12 months, currently active only.
        foreach ($subscriptions as $subscription) {
            if ($subscription->status !== SubscriptionStatus::Active) {
                continue;
            }
            $amount = $this->converter->convert((float) $subscription->amount, $subscription->currency, $currency);
            if ($amount === null) {
                continue;
            }
            $next12 += $amount * iterator_count($this->occurrences($subscription, $today->addDay(), $horizon));
        }

        $monthRows = array_map(fn (array $m) => [
            'month' => $m['month'],
            'paid' => (int) round($m['paid']),
            'expected' => (int) round($m['expected']),
        ], array_values($months));
        $spent = array_sum(array_column($monthRows, 'paid'));
        $expected = array_sum(array_column($monthRows, 'expected'));

        usort($savingItems, fn (array $a, array $b) => $b['saved'] <=> $a['saved'] ?: $a['subscription_id'] <=> $b['subscription_id']);
        $byCategory = collect($categories)
            ->filter(fn (array $c) => $c['now'] > 0 || $c['before'] > 0)
            ->map(fn (array $c) => [
                'category_id' => $c['category_id'],
                'label' => $c['label'],
                'monthly' => (int) round($c['now']),
                'change' => (int) round($c['now']) - (int) round($c['before']),
            ])
            ->sortByDesc('monthly')
            ->values()
            ->all();
        usort($payments, fn (array $a, array $b) => [$a['date'], $a['subscription_id']] <=> [$b['date'], $b['subscription_id']]);

        $monthlySaving = (int) round($savingMonthly);

        $result = [
            'currency' => $currency,
            'year' => $query->year,
            'today' => $today->toDateString(),
            'months' => $monthRows,
            'spent_so_far' => $spent,
            'projected_year' => $spent + $expected,
            'savings' => [
                'total' => array_sum(array_column($savingItems, 'saved')),
                'monthly' => $monthlySaving,
                'yearly' => $monthlySaving * 12,
                'items' => $savingItems,
            ],
            'by_category' => $byCategory,
            'biggest' => $biggest === null ? null : [...$biggest, 'monthly' => (int) round($biggest['monthly'])],
            'next_12_months' => (int) round($next12),
            'unconverted' => array_values($unconverted),
        ];

        if ($query->month !== null) {
            $result['payments'] = $payments;
        }

        return $result;
    }

    /** @return list<array{date: CarbonImmutable, status: SubscriptionStatus}> oldest first, dates in the user's timezone */
    private function timeline(Subscription $subscription, string $timezone): array
    {
        return $subscription->statusChanges
            ->sortBy(fn ($c) => [$c->changed_at->getTimestamp(), $c->id])
            ->map(fn ($c) => [
                'date' => CarbonImmutable::parse($c->changed_at->setTimezone($timezone)->toDateString()),
                'status' => $c->status,
            ])
            ->values()
            ->all();
    }

    /** @param list<array{date: CarbonImmutable, status: SubscriptionStatus}> $timeline */
    private function statusAt(array $timeline, CarbonImmutable $date): SubscriptionStatus
    {
        $status = SubscriptionStatus::Active;
        foreach ($timeline as $change) {
            if ($change['date']->gt($date)) {
                break;
            }
            $status = $change['status'];
        }

        return $status;
    }

    /** @return \Generator<int, CarbonImmutable> payment dates from $from to $to inclusive */
    private function occurrences(Subscription $subscription, CarbonImmutable $from, CarbonImmutable $to): \Generator
    {
        $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $from);
        while ($date->lte($to)) {
            yield $date;
            $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $date->addDay());
        }
    }
}
