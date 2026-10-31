<?php

use App\Models\Category;
use App\Models\ExchangeRate;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Services\DashboardCache;
use App\Services\SpendCalculator;
use Illuminate\Support\Facades\Http;

function category(string $key): int
{
    return Category::whereNull('user_id')->where('key', $key)->value('id');
}

beforeEach(function () {
    $this->travelTo('2026-10-31 12:00:00');
    ExchangeRate::insert(['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25]);
    $this->user = User::factory()->create(['currency' => 'EUR']);
    $this->calc = app(SpendCalculator::class);
});

it('normalizes every period to a monthly equivalent', function () {
    $make = fn (string $period, int $interval, int $amount) => Subscription::factory()->make(compact('period', 'amount') + ['interval_count' => $interval]);

    expect($this->calc->monthlyEquivalent($make('week', 1, 1000)))->toEqualWithDelta(4333.33, 0.01)
        ->and($this->calc->monthlyEquivalent($make('month', 1, 1500)))->toBe(1500.0)
        ->and($this->calc->monthlyEquivalent($make('month', 3, 3000)))->toBe(1000.0)
        ->and($this->calc->monthlyEquivalent($make('year', 1, 12000)))->toBe(1000.0);
});

it('builds the dashboard in the user currency', function () {
    $sub = fn (array $attrs) => Subscription::factory()->for($this->user)->create($attrs);
    $netflix = $sub(['amount' => 1500, 'currency' => 'EUR', 'category_id' => category('video_streaming'), 'first_payment_date' => '2026-01-05']);
    $sub(['amount' => 1250, 'currency' => 'USD', 'category_id' => category('music')]);
    $sub(['amount' => 12000, 'currency' => 'EUR', 'period' => 'year', 'category_id' => category('software_cloud'), 'first_payment_date' => '2026-03-01']);
    $sub(['amount' => 9999, 'status' => 'paused']);
    $odd = $sub(['amount' => 500, 'currency' => 'XYZ']);

    $d = $this->calc->dashboard($this->user);

    expect($d['currency'])->toBe('EUR')
        ->and($d['monthly_total'])->toBe(3500)
        ->and($d['yearly_total'])->toBe(42000)
        ->and($d['count'])->toBe(4)
        ->and($d['unconverted'])->toBe([['subscription_id' => $odd->id, 'currency' => 'XYZ']])
        ->and($d['most_expensive'][0])->toMatchArray(['subscription_id' => $netflix->id, 'monthly' => 1500]);

    $byKey = collect($d['by_category'])->keyBy('label');
    expect($byKey['Video Streaming'])->toMatchArray(['monthly' => 1500, 'percent' => 42.9])
        ->and($byKey['Music'])->toMatchArray(['monthly' => 1000, 'percent' => 28.6]);
});

it('lists every payment in the next 30 days, including repeats of weekly subscriptions', function () {
    Subscription::factory()->for($this->user)->create(['period' => 'week', 'first_payment_date' => '2026-10-01']);
    Subscription::factory()->for($this->user)->create(['first_payment_date' => '2026-01-05']);

    $dates = collect($this->calc->dashboard($this->user)['upcoming'])->pluck('date')->all();

    expect($dates)->toBe(['2026-11-05', '2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
});

function cachedDashboard(): array
{
    return DashboardCache::remember(test()->user, fn () => test()->calc->dashboard(test()->user->fresh()));
}

/** Adds a subscription without firing model events, so the cache is not invalidated. */
function silentSubscription(): Subscription
{
    $service = Service::factory()->create();

    return Subscription::withoutEvents(fn () => Subscription::factory()->for(test()->user)->create([
        'service_id' => $service->id,
        'next_payment_date' => '2026-11-05',
    ]));
}

it('invalidates the cached dashboard when a subscription is created', function () {
    expect(cachedDashboard()['count'])->toBe(0);
    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(0);

    Subscription::factory()->for($this->user)->create();

    expect(cachedDashboard()['count'])->toBe(2);
});

it('invalidates the cached dashboard when a subscription is deleted and restored', function () {
    $sub = Subscription::factory()->for($this->user)->create();
    expect(cachedDashboard()['count'])->toBe(1);

    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(1);

    $sub->delete();
    expect(cachedDashboard()['count'])->toBe(1);

    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(1);

    $sub->restore();
    expect(cachedDashboard()['count'])->toBe(3);
});

it('invalidates the cached dashboard when the user currency changes', function () {
    expect(cachedDashboard()['currency'])->toBe('EUR');
    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(0);

    $this->user->update(['currency' => 'USD']);

    expect(cachedDashboard())->toMatchArray(['currency' => 'USD', 'count' => 1]);
});

it('invalidates the cached dashboard when the user timezone changes', function () {
    expect(cachedDashboard()['count'])->toBe(0);
    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(0);

    $this->user->update(['timezone' => 'Asia/Tokyo']);

    expect(cachedDashboard()['count'])->toBe(1);
});

it('keeps the cache when an unrelated user attribute changes', function () {
    expect(cachedDashboard()['count'])->toBe(0);
    silentSubscription();

    $this->user->update(['name' => 'Someone Else']);

    expect(cachedDashboard()['count'])->toBe(0);
});

it('invalidates every cached dashboard on flushAll', function () {
    expect(cachedDashboard()['count'])->toBe(0);
    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(0);

    DashboardCache::flushAll();

    expect(cachedDashboard()['count'])->toBe(1);
});

it('invalidates every cached dashboard when exchange rates are fetched', function () {
    Http::fake([config('subs.ecb_url') => Http::response(file_get_contents(base_path('tests/Fixtures/ecb-daily.xml')))]);
    expect(cachedDashboard()['count'])->toBe(0);
    silentSubscription();
    expect(cachedDashboard()['count'])->toBe(0);

    $this->artisan('rates:fetch')->assertSuccessful();

    expect(cachedDashboard()['count'])->toBe(1);
});
