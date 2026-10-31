<?php

use App\Enums\Period;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;

function day(string $date): CarbonImmutable
{
    return CarbonImmutable::parse($date);
}

it('keeps a month-end anchor without drifting', function () {
    $first = day('2026-01-31');

    expect(BillingCycle::nth($first, Period::Month, 1, 1)->toDateString())->toBe('2026-02-28')
        ->and(BillingCycle::nth($first, Period::Month, 1, 2)->toDateString())->toBe('2026-03-31')
        ->and(BillingCycle::nth($first, Period::Month, 1, 3)->toDateString())->toBe('2026-04-30');
});

it('handles a leap-day yearly anchor', function () {
    $first = day('2024-02-29');

    expect(BillingCycle::nth($first, Period::Year, 1, 1)->toDateString())->toBe('2025-02-28')
        ->and(BillingCycle::nth($first, Period::Year, 1, 4)->toDateString())->toBe('2028-02-29');
});

it('handles weekly and every-3-months intervals', function () {
    expect(BillingCycle::nth(day('2026-10-01'), Period::Week, 1, 5)->toDateString())->toBe('2026-11-05')
        ->and(BillingCycle::nth(day('2026-01-15'), Period::Month, 3, 4)->toDateString())->toBe('2027-01-15');
});

it('finds the next occurrence on or after a date', function (string $first, Period $period, int $interval, string $date, string $expected) {
    expect(BillingCycle::nextOnOrAfter(day($first), $period, $interval, day($date))->toDateString())->toBe($expected);
})->with([
    'first payment in the future' => ['2026-12-01', Period::Month, 1, '2026-10-31', '2026-12-01'],
    'payment is today' => ['2026-01-31', Period::Month, 1, '2026-10-31', '2026-10-31'],
    'month-end anchor' => ['2026-01-31', Period::Month, 1, '2026-03-01', '2026-03-31'],
    'weekly' => ['2026-10-01', Period::Week, 1, '2026-10-31', '2026-11-05'],
    'every 3 months' => ['2026-01-15', Period::Month, 3, '2026-10-31', '2027-01-15'],
    'yearly' => ['2020-06-10', Period::Year, 1, '2026-10-31', '2027-06-10'],
]);
