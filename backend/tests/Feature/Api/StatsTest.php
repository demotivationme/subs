<?php

use App\Models\Category;
use App\Models\ExchangeRate;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\SubscriptionStatusChange;
use App\Models\User;

function statsCategory(string $key): int
{
    return Category::whereNull('user_id')->where('key', $key)->value('id');
}

/** @param list<array{string, string}> $changes [status, 'Y-m-d H:i:s' in UTC] */
function sub(User $user, array $attrs = [], array $changes = []): Subscription
{
    $sub = Subscription::factory()->for($user)->create($attrs);
    foreach ($changes as [$status, $at]) {
        SubscriptionStatusChange::create(['subscription_id' => $sub->id, 'status' => $status, 'changed_at' => $at]);
    }

    return $sub;
}

beforeEach(function () {
    $this->travelTo('2026-11-02 12:00:00');
    ExchangeRate::insert(['date' => '2026-11-01', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25]);
    $this->me = actingAsUser(['currency' => 'EUR', 'timezone' => 'UTC']);
    $this->stats = fn (string $query = '') => $this->getJson('/api/v1/stats'.$query);
});

it('splits a monthly subscription into paid and expected around today', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2025-06-05']);

    $r = ($this->stats)()->assertOk()
        ->assertJsonPath('currency', 'EUR')->assertJsonPath('year', 2026)->assertJsonPath('today', '2026-11-02')
        ->assertJsonCount(12, 'months')->assertJsonMissingPath('payments');

    $months = collect($r->json('months'));
    expect($months->take(10)->every(fn ($m) => $m['paid'] === 1000 && $m['expected'] === 0))->toBeTrue()
        ->and($months[10])->toMatchArray(['month' => 11, 'paid' => 0, 'expected' => 1000])
        ->and($months[11])->toMatchArray(['month' => 12, 'paid' => 0, 'expected' => 1000]);
    $r->assertJsonPath('spent_so_far', 10000)->assertJsonPath('projected_year', 12000);
});

it('puts a yearly subscription only in its month', function () {
    sub($this->me, ['amount' => 12000, 'period' => 'year', 'first_payment_date' => '2024-03-20']);

    $months = collect(($this->stats)()->json('months'));
    expect($months[2])->toMatchArray(['paid' => 12000, 'expected' => 0])
        ->and($months->except(2)->sum('paid') + $months->except(2)->sum('expected'))->toBe(0);
});

it('pays nothing while paused and pays again once resumed', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-01-10'], [
        ['active', '2026-01-01 00:00:00'], ['paused', '2026-03-15 10:00:00'], ['active', '2026-06-10 09:00:00'],
    ]);

    $paid = collect(($this->stats)()->json('months'))->pluck('paid', 'month');
    // Paused from Mar 15 through Jun 9: Apr, May and Jun 10 is paying again (resume day counts as paying).
    expect($paid[3])->toBe(1000)->and($paid[4])->toBe(0)->and($paid[5])->toBe(0)
        ->and($paid[6])->toBe(1000)->and($paid[7])->toBe(1000);
});

it('counts the occurrence on the change date as saved', function () {
    $service = Service::factory()->create(['name' => 'Disney+']);
    $disney = sub($this->me, ['service_id' => $service->id, 'amount' => 899, 'first_payment_date' => '2025-01-01', 'status' => 'cancelled'], [
        ['active', '2025-01-01 00:00:00'], ['cancelled', '2026-08-01 08:00:00'],
    ]);

    $r = ($this->stats)();
    $r->assertJsonPath('savings.total', 3596)->assertJsonPath('savings.monthly', 899)->assertJsonPath('savings.yearly', 10788)
        ->assertJsonPath('savings.items.0.subscription_id', $disney->id)
        ->assertJsonPath('savings.items.0.name', 'Disney+')
        ->assertJsonPath('savings.items.0.status', 'cancelled')
        ->assertJsonPath('savings.items.0.since', '2026-08-01')
        ->assertJsonPath('savings.items.0.monthly', 899)
        ->assertJsonPath('savings.items.0.saved', 3596)
        ->assertJsonPath('savings.items.0.service.name', 'Disney+');
    // Aug 1 .. Nov 1 are not paid.
    $paid = collect($r->json('months'))->pluck('paid', 'month');
    expect($paid[7])->toBe(899)->and($paid[8])->toBe(0)->and($paid[11])->toBe(0);
});

it('counts only the paused period when resumed, and monthly/yearly only cover inactive now', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-01-10'], [
        ['active', '2026-01-01 00:00:00'], ['paused', '2026-03-15 10:00:00'], ['active', '2026-06-10 09:00:00'],
    ]);
    sub($this->me, ['amount' => 500, 'first_payment_date' => '2026-01-10', 'status' => 'paused'], [
        ['active', '2026-01-01 00:00:00'], ['paused', '2026-10-10 00:00:00'],
    ]);

    // First: Apr 10 and May 10 (Jun 10 is paying again). Second: Oct 10 (paused that day).
    ($this->stats)()
        ->assertJsonPath('savings.total', 2500)
        ->assertJsonPath('savings.monthly', 500)
        ->assertJsonPath('savings.yearly', 6000)
        ->assertJsonPath('next_12_months', 12000);
});

it('treats the status at a date in the user timezone', function () {
    $this->me->update(['timezone' => 'Pacific/Auckland']); // UTC+13 in November
    $this->travelTo('2026-11-02 12:00:00');
    // 2026-08-31 20:00 UTC is Sep 1 in Auckland: the Sep 1 payment is already saved.
    sub($this->me, ['amount' => 100, 'first_payment_date' => '2026-01-01', 'status' => 'cancelled'], [
        ['active', '2026-01-01 00:00:00'], ['cancelled', '2026-08-31 20:00:00'],
    ]);

    ($this->stats)()->assertJsonPath('savings.items.0.since', '2026-09-01')->assertJsonPath('savings.total', 300);
});

it('compares categories with the end of last month', function () {
    $video = statsCategory('video_streaming');
    $music = statsCategory('music');
    sub($this->me, ['amount' => 1500, 'category_id' => $video, 'first_payment_date' => '2026-01-05']);
    sub($this->me, ['amount' => 899, 'category_id' => $video, 'first_payment_date' => '2026-01-05', 'status' => 'cancelled'], [
        ['active', '2026-01-01 00:00:00'], ['cancelled', '2026-11-01 08:00:00'],
    ]);
    sub($this->me, ['amount' => 700, 'category_id' => $music, 'first_payment_date' => '2026-01-05', 'status' => 'cancelled'], [
        ['active', '2026-01-01 00:00:00'], ['cancelled', '2026-11-01 08:00:00'],
    ]);

    $by = collect(($this->stats)()->json('by_category'))->keyBy('category_id');
    expect($by[$video])->toMatchArray(['monthly' => 1500, 'change' => -899])
        ->and($by[$music])->toMatchArray(['monthly' => 0, 'change' => -700]);
});

it('finds the biggest active expense and the next 12 months', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-01-05']);
    $big = sub($this->me, ['amount' => 24000, 'period' => 'year', 'first_payment_date' => '2025-12-01']);
    sub($this->me, ['amount' => 99999, 'first_payment_date' => '2026-01-05', 'status' => 'paused']);

    // monthly: Nov 5 .. Oct 5 2027 = 12 payments; yearly: Dec 1 2026 only.
    ($this->stats)()
        ->assertJsonPath('biggest.subscription_id', $big->id)->assertJsonPath('biggest.monthly', 2000)
        ->assertJsonPath('next_12_months', 12 * 1000 + 24000);
});

it('has a null biggest without active subscriptions', function () {
    ($this->stats)()->assertOk()->assertJsonPath('biggest', null)->assertJsonPath('next_12_months', 0);
});

it('converts currencies and lists unconvertible ones', function () {
    sub($this->me, ['amount' => 1250, 'currency' => 'USD', 'first_payment_date' => '2026-01-05']); // = 1000 EUR
    $odd = sub($this->me, ['amount' => 500, 'currency' => 'XYZ', 'first_payment_date' => '2026-01-05']);

    $r = ($this->stats)('?month=11');
    $r->assertJsonPath('months.0.paid', 1000)
        ->assertJsonPath('unconverted', [['subscription_id' => $odd->id, 'currency' => 'XYZ']]);
    $payments = collect($r->json('payments'));
    expect($payments->firstWhere('currency', 'USD')['converted'])->toBe(1000)
        ->and($payments->firstWhere('currency', 'XYZ')['converted'])->toBeNull();
});

it('lists the payments of a month sorted by date', function () {
    $a = sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-01-20']);
    $b = sub($this->me, ['amount' => 2000, 'first_payment_date' => '2026-01-05']);
    sub($this->me, ['amount' => 300, 'period' => 'week', 'first_payment_date' => '2026-10-28']);
    sub($this->me, ['amount' => 9, 'first_payment_date' => '2026-01-10', 'status' => 'paused'], [['active', '2026-01-01 00:00:00'], ['paused', '2026-02-01 00:00:00']]);

    $r = ($this->stats)('?year=2026&month=11')->assertOk();
    $rows = collect($r->json('payments'));
    expect($rows->pluck('date')->all())->toBe(['2026-11-04', '2026-11-05', '2026-11-11', '2026-11-18', '2026-11-20', '2026-11-25'])
        ->and($rows->pluck('state')->all())->toBe(['expected', 'expected', 'expected', 'expected', 'expected', 'expected'])
        ->and($rows->firstWhere('subscription_id', $b->id))->toMatchArray(['amount' => 2000, 'currency' => 'EUR', 'converted' => 2000]);

    $oct = collect(($this->stats)('?month=10')->json('payments'));
    expect($oct->pluck('state')->unique()->all())->toBe(['paid']);
});

it('only looks at the requested year for months but always as of today for the rest', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2025-01-05']);

    $r = ($this->stats)('?year=2025');
    expect(collect($r->json('months'))->sum('paid'))->toBe(12000);
    $r->assertJsonPath('spent_so_far', 12000)->assertJsonPath('projected_year', 12000)->assertJsonPath('next_12_months', 12000);
});

it('ignores soft-deleted subscriptions', function () {
    sub($this->me, ['amount' => 1000])->delete();

    ($this->stats)()->assertJsonPath('spent_so_far', 0)->assertJsonPath('biggest', null);
});

it('never shows another user\'s data', function () {
    sub(User::factory()->create(), ['amount' => 5000]);

    ($this->stats)()->assertJsonPath('spent_so_far', 0)->assertJsonPath('next_12_months', 0);
});

it('validates year and month', function (string $query) {
    ($this->stats)($query)->assertUnprocessable();
})->with(['?year=1999', '?year=2028', '?year=abc', '?month=0', '?month=13', '?month=x']);

it('accepts next year', function () {
    ($this->stats)('?year=2027')->assertOk()->assertJsonPath('year', 2027);
});

it('rejects guests', function () {
    $this->refreshApplication();
    $this->getJson('/api/v1/stats')->assertUnauthorized();
});

it('makes the savings total equal the sum of the rounded items', function () {
    // 333 USD / 1.25 = 266.4 per payment; 3 payments (Aug 1, Sep 1, Oct 1, Nov 1 = 4): 1065.6 -> 1066 each row rounds individually.
    foreach ([333, 334] as $amount) {
        sub($this->me, ['amount' => $amount, 'currency' => 'USD', 'first_payment_date' => '2026-08-01', 'status' => 'cancelled'], [
            ['active', '2026-07-01 00:00:00'], ['cancelled', '2026-08-01 08:00:00'],
        ]);
    }

    $r = ($this->stats)();
    $items = collect($r->json('savings.items'));
    // 4 * 266.4 = 1065.6 -> 1066; 4 * 267.2 = 1068.8 -> 1069; floats sum 2134.4 -> 2134, rows sum 2135.
    expect($items->pluck('saved')->sort()->values()->all())->toBe([1066, 1069])
        ->and($r->json('savings.total'))->toBe(2135);
});

it('shows a positive category change for a subscription that started this month', function () {
    $cat = statsCategory('music');
    sub($this->me, ['amount' => 700, 'category_id' => $cat, 'first_payment_date' => '2026-11-01'], [['active', '2026-11-01 08:00:00']]);

    $by = collect(($this->stats)()->json('by_category'))->keyBy('category_id');
    expect($by[$cat])->toMatchArray(['monthly' => 700, 'change' => 700]);
});

it('reports since and until for resumed and still-inactive subscriptions', function () {
    $resumed = sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-01-10'], [
        ['active', '2026-01-01 00:00:00'], ['paused', '2026-03-15 10:00:00'], ['active', '2026-06-10 09:00:00'],
    ]);
    $paused = sub($this->me, ['amount' => 500, 'first_payment_date' => '2026-01-10', 'status' => 'paused'], [
        ['active', '2026-01-01 00:00:00'], ['paused', '2026-10-10 00:00:00'],
    ]);

    $items = collect(($this->stats)()->json('savings.items'))->keyBy('subscription_id');
    expect($items[$resumed->id])->toMatchArray(['status' => 'active', 'since' => '2026-03-15', 'until' => '2026-06-10'])
        ->and($items[$paused->id])->toMatchArray(['status' => 'paused', 'since' => '2026-10-10', 'until' => null]);
});

it('counts an occurrence exactly on today as paid', function () {
    sub($this->me, ['amount' => 1000, 'first_payment_date' => '2026-09-02']);

    $months = collect(($this->stats)('?month=11')->json('months'));
    expect($months[10])->toMatchArray(['paid' => 1000, 'expected' => 0]);
    expect(($this->stats)('?month=11')->json('payments.0'))->toMatchArray(['date' => '2026-11-02', 'state' => 'paid']);
});

it('honours interval_count in the months', function () {
    sub($this->me, ['amount' => 3000, 'interval_count' => 3, 'first_payment_date' => '2026-02-15']);

    $months = collect(($this->stats)()->json('months'));
    $paying = $months->filter(fn ($m) => $m['paid'] + $m['expected'] > 0)->pluck('month')->all();
    expect($paying)->toBe([2, 5, 8, 11]);
});

it('takes the end of last month in the user timezone', function () {
    // Auckland (UTC+13): now is Nov 3 01:00 local, so last month ended Oct 31.
    $this->me->update(['timezone' => 'Pacific/Auckland']);
    $cat = statsCategory('music');
    // Cancelled at Oct 31 20:00 UTC = Nov 1 09:00 local: still active at the end of October locally.
    sub($this->me, ['amount' => 700, 'category_id' => $cat, 'first_payment_date' => '2026-01-05', 'status' => 'cancelled'], [
        ['active', '2026-01-01 00:00:00'], ['cancelled', '2026-10-31 20:00:00'],
    ]);

    $by = collect(($this->stats)()->json('by_category'))->keyBy('category_id');
    expect($by[$cat])->toMatchArray(['monthly' => 0, 'change' => -700]);
});
