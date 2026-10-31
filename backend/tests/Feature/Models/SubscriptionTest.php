<?php

use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Models\User;

it('computes next_payment_date from the anchor on create and on anchor change', function () {
    $this->travelTo('2026-10-31 12:00:00');
    $sub = Subscription::factory()->create(['first_payment_date' => '2026-01-31']);

    expect($sub->next_payment_date->toDateString())->toBe('2026-10-31');

    $sub->update(['first_payment_date' => '2026-01-05']);
    expect($sub->fresh()->next_payment_date->toDateString())->toBe('2026-11-05');
});

it("uses the user's local date, not UTC", function () {
    // 12:00 UTC on Oct 31 is already 01:00 on Nov 1 in Auckland.
    $this->travelTo('2026-10-31 12:00:00');
    $user = User::factory()->create(['timezone' => 'Pacific/Auckland']);
    $sub = Subscription::factory()->for($user)->create(['first_payment_date' => '2026-01-31']);

    expect($user->today()->toDateString())->toBe('2026-11-01')
        ->and($sub->next_payment_date->toDateString())->toBe('2026-11-30');
});

it('prefers subscription rules over user defaults', function () {
    $sub = Subscription::factory()->create();
    ReminderRule::factory()->for($sub->user)->create(['days_before' => 1]);

    expect($sub->effectiveReminderRules()->pluck('days_before')->all())->toBe([1]);

    ReminderRule::factory()->for($sub->user)->create(['subscription_id' => $sub->id, 'days_before' => 3]);
    $sub->load('reminderRules');

    expect($sub->effectiveReminderRules()->pluck('days_before')->all())->toBe([3]);
});

it('reads time_of_day as H:i', function () {
    $rule = ReminderRule::factory()->create(['time_of_day' => '07:30']);

    expect($rule->fresh()->time_of_day)->toBe('07:30');
});
