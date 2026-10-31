<?php

use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\PaymentReminder;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;

function subscriber(string $timezone = 'Europe/Paris', array $sub = [], array $rule = []): Subscription
{
    $user = User::factory()->create(['timezone' => $timezone]);
    ReminderRule::factory()->for($user)->create(['days_before' => 1, 'time_of_day' => '09:00', ...$rule]);

    // Monthly on the 5th → next payment 2026-11-05.
    return Subscription::factory()->for($user)->create(['first_payment_date' => '2026-01-05', ...$sub]);
}

function dispatchAt(string $utc): void
{
    test()->travelTo($utc);
    test()->artisan('reminders:dispatch')->assertSuccessful();
}

beforeEach(function () {
    Notification::fake();
    $this->travelTo('2026-10-31 12:00:00');
});

it('sends at the local reminder time and exactly once', function () {
    $sub = subscriber(); // due 2026-11-04 09:00 Paris = 08:00 UTC

    dispatchAt('2026-11-04 07:59:00');
    Notification::assertNothingSent();

    dispatchAt('2026-11-04 08:00:00');
    dispatchAt('2026-11-04 08:15:00');
    Notification::assertSentToTimes($sub->user, PaymentReminder::class, 1);
    Notification::assertSentTo($sub->user, PaymentReminder::class, fn ($n) => $n->paymentDate->toDateString() === '2026-11-05');
});

it('respects time zones far from UTC', function () {
    $tokyo = subscriber('Asia/Tokyo');               // 2026-11-04 09:00 JST = 00:00 UTC
    $la = subscriber('America/Los_Angeles');         // 2026-11-04 09:00 PST = 17:00 UTC

    dispatchAt('2026-11-04 01:00:00');

    Notification::assertSentTo($tokyo->user, PaymentReminder::class);
    Notification::assertNotSentTo($la->user, PaymentReminder::class);
});

it('catches up within 24 hours but not later', function () {
    $late = subscriber();
    dispatchAt('2026-11-05 07:00:00'); // 23h after the moment
    Notification::assertSentTo($late->user, PaymentReminder::class);

    Notification::fake();
    $tooLate = subscriber();
    dispatchAt('2026-11-05 08:30:00'); // 24.5h after the moment
    Notification::assertNotSentTo($tooLate->user, PaymentReminder::class);
});

it('uses subscription rules instead of defaults', function () {
    $sub = subscriber();
    ReminderRule::factory()->for($sub->user)->create(['subscription_id' => $sub->id, 'days_before' => 3, 'time_of_day' => '09:00']);

    dispatchAt('2026-11-04 08:00:00'); // default moment
    Notification::assertNothingSent();

    dispatchAt('2026-11-02 08:00:00'); // 3 days before
    Notification::assertSentTo($sub->user, PaymentReminder::class, fn ($n) => $n->rule->days_before === 3);
});

it('skips paused subscriptions', function () {
    subscriber(sub: ['status' => 'paused']);

    dispatchAt('2026-11-04 08:00:00');
    Notification::assertNothingSent();
});

it('does not resend after the user edits the same rule', function () {
    $sub = subscriber();
    dispatchAt('2026-11-04 08:00:00');

    Sanctum::actingAs($sub->user);
    $this->putJson('/api/v1/reminder-defaults', ['rules' => [
        ['days_before' => 1, 'time_of_day' => '09:05', 'channels' => ['email']],
    ]])->assertOk();

    dispatchAt('2026-11-04 08:15:00');
    Notification::assertSentToTimes($sub->user, PaymentReminder::class, 1);
});

it('reminds about the right occurrence when the lead time exceeds the period', function () {
    // Weekly from Thu 2026-10-01; 14 days before at 09:00 UTC.
    $sub = subscriber('UTC', ['period' => 'week', 'first_payment_date' => '2026-10-01'], ['days_before' => 14]);

    dispatchAt('2026-11-05 09:00:00');

    Notification::assertSentTo($sub->user, PaymentReminder::class, fn ($n) => $n->paymentDate->toDateString() === '2026-11-19');
});

it('advances stale next payment dates', function () {
    $sub = subscriber();
    Subscription::whereKey($sub->id)->update(['next_payment_date' => '2026-09-05']);

    dispatchAt('2026-10-31 12:00:00');

    expect($sub->fresh()->next_payment_date->toDateString())->toBe('2026-11-05');
});

it('reports health from the scheduler heartbeat', function () {
    $this->get('/up')->assertStatus(500);

    dispatchAt('2026-10-31 12:00:00');
    $this->get('/up')->assertOk();

    $this->travelTo('2026-10-31 12:31:00');
    $this->get('/up')->assertStatus(500);
});
