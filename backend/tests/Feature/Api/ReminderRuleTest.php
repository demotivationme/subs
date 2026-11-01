<?php

use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

it('shows and replaces default rules', function () {
    $me = actingAsUser();
    ReminderRule::factory()->for($me)->create();

    $this->getJson('/api/v1/reminder-defaults')->assertOk()->assertJsonPath('data.0.days_before', 1);

    $this->putJson('/api/v1/reminder-defaults', ['rules' => [
        ['days_before' => 7, 'time_of_day' => '18:00', 'channels' => ['email']],
        ['days_before' => 1, 'time_of_day' => '08:30', 'channels' => ['push', 'in_app', 'email']],
    ]])->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.days_before', 1)->assertJsonPath('data.0.time_of_day', '08:30');
});

it('keeps rule ids when a rule with the same days_before is edited', function () {
    $me = actingAsUser();
    $rule = ReminderRule::factory()->for($me)->create(['days_before' => 1]);

    $this->putJson('/api/v1/reminder-defaults', ['rules' => [
        ['days_before' => 1, 'time_of_day' => '20:00', 'channels' => ['email']],
    ]])->assertOk()->assertJsonPath('data.0.id', $rule->id);
});

it('validates rules', function (array $rules, string $error) {
    actingAsUser();

    $this->putJson('/api/v1/reminder-defaults', ['rules' => $rules])->assertJsonValidationErrors($error);
})->with([
    'duplicate days' => [[['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['push']], ['days_before' => 1, 'time_of_day' => '10:00', 'channels' => ['push']]], 'rules.0.days_before'],
    'too many days' => [[['days_before' => 61, 'time_of_day' => '09:00', 'channels' => ['push']]], 'rules.0.days_before'],
    'bad time' => [[['days_before' => 1, 'time_of_day' => '9am', 'channels' => ['push']]], 'rules.0.time_of_day'],
    'bad channel' => [[['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['sms']]], 'rules.0.channels.0'],
    'no channel' => [[['days_before' => 1, 'time_of_day' => '09:00', 'channels' => []]], 'rules.0.channels'],
    'more than five' => [array_map(fn ($d) => ['days_before' => $d, 'time_of_day' => '09:00', 'channels' => ['push']], range(1, 6)), 'rules'],
]);

it('overrides and reverts per-subscription rules', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();

    $this->getJson("/api/v1/subscriptions/{$sub->id}/reminders")->assertJsonPath('meta.uses_defaults', true);

    $this->putJson("/api/v1/subscriptions/{$sub->id}/reminders", ['rules' => [
        ['days_before' => 3, 'time_of_day' => '09:00', 'channels' => ['push']],
    ]])->assertOk()->assertJsonPath('meta.uses_defaults', false)->assertJsonPath('data.0.days_before', 3);

    $this->putJson("/api/v1/subscriptions/{$sub->id}/reminders", ['rules' => []])
        ->assertOk()
        ->assertJsonPath('meta.uses_defaults', true);
});

it('hides other users subscriptions rules', function () {
    actingAsUser();
    $foreign = Subscription::factory()->create();

    $this->getJson("/api/v1/subscriptions/{$foreign->id}/reminders")->assertNotFound();
});

it('rejects duplicate channels within one rule', function () {
    actingAsUser();

    $this->putJson('/api/v1/reminder-defaults', ['rules' => [
        ['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['push', 'push']],
    ]])->assertJsonValidationErrors('rules.0.channels');
});

it('rejects a duplicate days_before within a scope at the database level', function () {
    $user = User::factory()->create();
    $sub = Subscription::factory()->for($user)->create();
    ReminderRule::factory()->for($user)->create(['days_before' => 1]);
    ReminderRule::factory()->for($user)->create(['days_before' => 1, 'subscription_id' => $sub->id]); // other scope: fine

    // Each attempt runs in a savepoint so the first violation doesn't abort the test transaction.
    $insert = fn (array $attributes) => fn () => DB::transaction(fn () => ReminderRule::factory()->for($user)->create($attributes));

    expect($insert(['days_before' => 1]))->toThrow(QueryException::class, 'reminder_rules_scope_days_before_unique')
        ->and($insert(['days_before' => 1, 'subscription_id' => $sub->id]))->toThrow(QueryException::class, 'reminder_rules_scope_days_before_unique');
});
