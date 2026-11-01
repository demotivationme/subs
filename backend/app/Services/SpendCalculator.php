<?php

namespace App\Services;

use App\Enums\Period;
use App\Models\Subscription;
use App\Models\User;
use App\Repositories\SubscriptionRepository;

final class SpendCalculator
{
    public function __construct(
        private readonly CurrencyConverter $converter,
        private readonly SubscriptionRepository $subscriptions,
    ) {}

    /** Monthly cost in the subscription's own currency, minor units. */
    public function monthlyEquivalent(Subscription $subscription): float
    {
        $amount = (float) $subscription->amount;
        $interval = $subscription->interval_count;

        return match ($subscription->period) {
            Period::Week => $amount * 52 / 12 / $interval,
            Period::Month => $amount / $interval,
            Period::Year => $amount / (12 * $interval),
        };
    }

    public function monthlyIn(Subscription $subscription, string $currency): ?float
    {
        return $this->converter->convert($this->monthlyEquivalent($subscription), $subscription->currency, $currency);
    }

    public function dashboard(User $user): array
    {
        $today = $user->today();
        $until = $today->addDays(30);
        $subscriptions = $this->subscriptions->activeForUser($user);

        $total = 0.0;
        $byCategory = [];
        $priced = [];
        $unconverted = [];
        $upcoming = [];

        foreach ($subscriptions as $subscription) {
            $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $today);
            while ($date->lte($until)) {
                $upcoming[] = [
                    'subscription_id' => $subscription->id,
                    'name' => $subscription->service->name,
                    'date' => $date->toDateString(),
                    'amount' => $subscription->amount,
                    'currency' => $subscription->currency,
                ];
                $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $date->addDay());
            }

            $monthly = $this->monthlyIn($subscription, $user->currency);
            if ($monthly === null) {
                $unconverted[] = ['subscription_id' => $subscription->id, 'currency' => $subscription->currency];

                continue;
            }

            $total += $monthly;
            $byCategory[$subscription->category_id] ??= [
                'category_id' => $subscription->category_id,
                'label' => $subscription->category->label(),
                'monthly' => 0.0,
            ];
            $byCategory[$subscription->category_id]['monthly'] += $monthly;
            $priced[] = ['subscription_id' => $subscription->id, 'name' => $subscription->service->name, 'monthly' => $monthly];
        }

        usort($upcoming, fn (array $a, array $b) => [$a['date'], $a['subscription_id']] <=> [$b['date'], $b['subscription_id']]);
        usort($priced, fn (array $a, array $b) => $b['monthly'] <=> $a['monthly']);

        return [
            'currency' => $user->currency,
            'monthly_total' => (int) round($total),
            'yearly_total' => (int) round($total * 12),
            'count' => $subscriptions->count(),
            'by_category' => collect($byCategory)
                ->sortByDesc('monthly')
                ->map(fn (array $c) => [
                    ...$c,
                    'monthly' => (int) round($c['monthly']),
                    'percent' => $total > 0 ? round($c['monthly'] / $total * 100, 1) : 0.0,
                ])
                ->values()
                ->all(),
            'upcoming' => $upcoming,
            'most_expensive' => array_map(
                fn (array $p) => [...$p, 'monthly' => (int) round($p['monthly'])],
                array_slice($priced, 0, 5),
            ),
            'unconverted' => $unconverted,
        ];
    }
}
