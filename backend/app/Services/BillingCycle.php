<?php

namespace App\Services;

use App\Enums\Period;
use Carbon\CarbonImmutable;

final class BillingCycle
{
    /** The k-th payment date (k = 0 is the first payment), always computed from the anchor. */
    public static function nth(CarbonImmutable $first, Period $period, int $interval, int $k): CarbonImmutable
    {
        $steps = $k * $interval;

        return match ($period) {
            Period::Week => $first->addWeeks($steps),
            Period::Month => $first->addMonthsNoOverflow($steps),
            Period::Year => $first->addYearsNoOverflow($steps),
        };
    }

    /** The first payment date that is on or after $date. */
    public static function nextOnOrAfter(CarbonImmutable $first, Period $period, int $interval, CarbonImmutable $date): CarbonImmutable
    {
        if ($first->gte($date)) {
            return $first;
        }

        $elapsed = match ($period) {
            Period::Week => (int) floor($first->diffInDays($date) / 7),
            Period::Month => (int) floor($first->diffInMonths($date)),
            Period::Year => (int) floor($first->diffInYears($date)),
        };

        // Start one step early so the estimate can never overshoot.
        $k = max(0, intdiv($elapsed, $interval) - 1);

        while (($candidate = self::nth($first, $period, $interval, $k))->lt($date)) {
            $k++;
        }

        return $candidate;
    }
}
