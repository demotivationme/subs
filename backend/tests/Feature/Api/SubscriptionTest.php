<?php

use App\Models\Category;
use App\Models\ExchangeRate;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Repositories\CategoryRepository;

function netflix(): Service
{
    return Service::whereNull('user_id')->where('name', 'Netflix')->first();
}

function payload(array $overrides = []): array
{
    return ['amount' => 1299, 'currency' => 'EUR', 'period' => 'month', 'first_payment_date' => '2026-01-31', ...$overrides];
}

beforeEach(fn () => $this->travelTo('2026-10-31 12:00:00'));

it('creates a subscription from a catalog service with its default category', function () {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_id' => netflix()->id]))
        ->assertCreated()
        ->assertJsonPath('data.service.name', 'Netflix')
        ->assertJsonPath('data.category.label', 'Video Streaming')
        ->assertJsonPath('data.next_payment_date', '2026-10-31')
        ->assertJsonPath('data.interval_count', 1)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.monthly_equivalent', 1299);
});

it('reuses the catalog service when the name is typed in another case', function () {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'NETFLIX']))
        ->assertCreated()
        ->assertJsonPath('data.service.id', netflix()->id)
        ->assertJsonPath('data.category.label', 'Video Streaming');
});

it('creates an own service in Other for unknown names', function () {
    $me = actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'Local Gym']))
        ->assertCreated()
        ->assertJsonPath('data.category.id', app(CategoryRepository::class)->other()->id);

    expect($me->services()->pluck('name')->all())->toBe(['Local Gym']);
});

it('validates input', function (array $overrides, string $field) {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload($overrides))->assertJsonValidationErrors($field);
})->with([
    'no service' => [[], 'service_id'],
    'foreign service' => [fn () => ['service_id' => Service::factory()->create(['user_id' => User::factory()->create()->id])->id], 'service_id'],
    'negative amount' => [['service_name' => 'X', 'amount' => -1], 'amount'],
    'bad currency' => [['service_name' => 'X', 'currency' => 'eur'], 'currency'],
    'bad period' => [['service_name' => 'X', 'period' => 'daily'], 'period'],
    'zero interval' => [['service_name' => 'X', 'interval_count' => 0], 'interval_count'],
    'bad date' => [['service_name' => 'X', 'first_payment_date' => '31/01/2026'], 'first_payment_date'],
]);

it('sorts by price across currencies and filters by status', function () {
    ExchangeRate::insert(['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25]);
    $me = actingAsUser(['currency' => 'EUR']);
    $cheapEur = Subscription::factory()->for($me)->create(['amount' => 900, 'currency' => 'EUR']);
    $usd = Subscription::factory()->for($me)->create(['amount' => 1250, 'currency' => 'USD']);  // = €10.00
    $yearly = Subscription::factory()->for($me)->create(['amount' => 24000, 'period' => 'year']); // = €20.00/mo
    Subscription::factory()->for($me)->create(['status' => 'paused']);

    $ids = collect($this->getJson('/api/v1/subscriptions?status=active&sort=price')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$yearly->id, $usd->id, $cheapEur->id]);
});

it('hides other users subscriptions', function () {
    actingAsUser();
    $foreign = Subscription::factory()->create(['amount' => 555]);

    $this->getJson("/api/v1/subscriptions/{$foreign->id}")->assertNotFound();
    $this->patchJson("/api/v1/subscriptions/{$foreign->id}", ['amount' => 1])->assertNotFound();
    $this->deleteJson("/api/v1/subscriptions/{$foreign->id}")->assertNotFound();

    expect(Subscription::find($foreign->id))->not->toBeNull()
        ->and(Subscription::find($foreign->id)->amount)->toBe(555);
});

it('updates, pauses and recomputes the next payment date', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create(['first_payment_date' => '2026-01-31']);

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['first_payment_date' => '2026-01-05', 'status' => 'paused'])
        ->assertOk()
        ->assertJsonPath('data.next_payment_date', '2026-11-05')
        ->assertJsonPath('data.status', 'paused');
});

it('soft deletes', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();

    $this->deleteJson("/api/v1/subscriptions/{$sub->id}")->assertNoContent();

    expect($this->getJson('/api/v1/subscriptions')->json('data'))->toBe([])
        ->and(Subscription::withTrashed()->find($sub->id))->not->toBeNull();
});

it('enforces the free limit only when configured and only for non-premium users', function () {
    config(['subs.free_subscription_limit' => 1]);
    $me = actingAsUser();
    Subscription::factory()->for($me)->create();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'X']))
        ->assertForbidden()
        ->assertJsonPath('message', __('subscriptions.limit_reached', ['limit' => config('subs.free_subscription_limit')]));

    $me->forceFill(['is_premium' => true])->save();
    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'X']))->assertCreated();
});

it('does not limit subscriptions when the limit is unconfigured', function () {
    actingAsUser();

    foreach (range(1, 6) as $i) {
        $this->postJson('/api/v1/subscriptions', payload(['service_name' => "Svc $i"]))->assertCreated();
    }
});

it('changes the service on update by name or by id', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();
    $spotify = Service::whereNull('user_id')->where('name', 'Spotify')->first();

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['service_name' => 'Spotify'])
        ->assertOk()->assertJsonPath('data.service.id', $spotify->id);

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['service_id' => netflix()->id])
        ->assertOk()->assertJsonPath('data.service.id', netflix()->id);
});

it('keeps the category when the service changes unless category_id is sent', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();
    $original = $sub->category_id;
    $other = app(CategoryRepository::class)->other();

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['service_id' => netflix()->id])
        ->assertOk()->assertJsonPath('data.category.id', $original);

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['service_id' => netflix()->id, 'category_id' => $other->id])
        ->assertOk()->assertJsonPath('data.category.id', $other->id);
});

it('rejects another users category on store and update', function () {
    $me = actingAsUser();
    $foreignCategory = Category::factory()->create(['user_id' => User::factory()->create()->id]);
    $sub = Subscription::factory()->for($me)->create();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'X', 'category_id' => $foreignCategory->id]))
        ->assertJsonValidationErrors('category_id');
    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['category_id' => $foreignCategory->id])
        ->assertJsonValidationErrors('category_id');
});

it('lets an explicit category override the service default on store', function () {
    actingAsUser();
    $other = app(CategoryRepository::class)->other();

    $this->postJson('/api/v1/subscriptions', payload(['service_id' => netflix()->id, 'category_id' => $other->id]))
        ->assertCreated()
        ->assertJsonPath('data.category.id', $other->id);
});

it('filters by category and sorts by name and next payment', function () {
    $me = actingAsUser();
    $catA = Category::factory()->create(['user_id' => $me->id]);
    $b = Subscription::factory()->for($me)->create([
        'service_id' => Service::factory()->create(['user_id' => $me->id, 'name' => 'banana'])->id,
        'first_payment_date' => '2026-01-20',
    ]);
    $a = Subscription::factory()->for($me)->create([
        'service_id' => Service::factory()->create(['user_id' => $me->id, 'name' => 'Apple'])->id,
        'category_id' => $catA->id,
        'first_payment_date' => '2026-01-25',
    ]);
    $c = Subscription::factory()->for($me)->create([
        'service_id' => Service::factory()->create(['user_id' => $me->id, 'name' => 'Cherry'])->id,
        'first_payment_date' => '2026-01-10',
    ]);
    $ids = fn (string $qs) => collect($this->getJson("/api/v1/subscriptions?$qs")->assertOk()->json('data'))->pluck('id')->all();

    expect($ids("category_id={$catA->id}"))->toBe([$a->id])
        ->and($ids('sort=name'))->toBe([$a->id, $b->id, $c->id])
        ->and($ids('sort=next_payment'))->toBe([$c->id, $b->id, $a->id])
        ->and($ids(''))->toBe([$c->id, $b->id, $a->id]);
});
