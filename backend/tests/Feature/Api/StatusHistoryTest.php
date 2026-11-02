<?php

use App\Models\Subscription;
use App\Models\SubscriptionStatusChange;

it('records the initial status on create', function () {
    $this->travelTo('2026-11-02 10:00:00');
    actingAsUser();

    $id = $this->postJson('/api/v1/subscriptions', [
        'service_name' => 'Gym', 'amount' => 500, 'currency' => 'EUR', 'period' => 'month', 'first_payment_date' => '2026-01-10',
    ])->assertCreated()->json('data.id');

    $rows = SubscriptionStatusChange::where('subscription_id', $id)->get();
    expect($rows)->toHaveCount(1)
        ->and($rows[0]->status->value)->toBe('active')
        ->and($rows[0]->changed_at->toDateTimeString())->toBe('2026-11-02 10:00:00');
});

it('records a row only when the status really changes', function () {
    $this->travelTo('2026-11-02 10:00:00');
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['notes' => 'hi', 'amount' => 700])->assertOk();
    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['status' => 'active'])->assertOk();
    expect(SubscriptionStatusChange::count())->toBe(0);

    $this->travelTo('2026-11-03 10:00:00');
    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['status' => 'paused'])->assertOk();
    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['status' => 'paused'])->assertOk();
    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['status' => 'active'])->assertOk();

    expect(SubscriptionStatusChange::orderBy('id')->get()->map(fn ($c) => $c->status->value)->all())->toBe(['paused', 'active']);
});

it('backfills existing subscriptions', function () {
    $active = Subscription::factory()->create(['created_at' => '2026-01-01 08:00:00']);
    $cancelled = Subscription::factory()->create(['status' => 'cancelled', 'created_at' => '2026-01-01 08:00:00', 'updated_at' => '2026-08-01 09:00:00']);
    $trashed = Subscription::factory()->create(['created_at' => '2026-02-01 08:00:00']);
    $trashed->delete();

    (require database_path('migrations/2026_11_02_000004_backfill_subscription_status_changes.php'))->up();

    $rows = fn ($s) => SubscriptionStatusChange::where('subscription_id', $s->id)->orderBy('id')->get()
        ->map(fn ($c) => $c->status->value.' '.$c->changed_at->toDateTimeString())->all();

    expect($rows($active))->toBe(['active 2026-01-01 08:00:00'])
        ->and($rows($cancelled))->toBe(['active 2026-01-01 08:00:00', 'cancelled 2026-08-01 09:00:00'])
        ->and($rows($trashed))->toHaveCount(1);
});
