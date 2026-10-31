<?php

use App\Models\DeviceToken;
use App\Models\ReminderRule;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\Channels\ExpoChannel;
use App\Notifications\PaymentReminder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;
use NotificationChannels\WebPush\WebPushChannel;

function reminder(User $user, array $channels, int $days = 1, array $sub = []): PaymentReminder
{
    $service = Service::whereNull('user_id')->where('name', 'Netflix')->first();
    $subscription = Subscription::factory()->for($user)->create(['service_id' => $service->id, 'amount' => 1299, ...$sub]);
    $rule = ReminderRule::factory()->for($user)->create(['days_before' => $days, 'channels' => $channels]);

    return new PaymentReminder($subscription, $rule, CarbonImmutable::parse('2026-11-30'));
}

it('picks channels from the rule and what the user can receive', function () {
    $user = User::factory()->create();
    expect(reminder($user, ['push', 'in_app', 'email'])->via($user))->toBe(['database', 'mail']);

    $user->deviceTokens()->create(['token' => 'ExponentPushToken[a]', 'platform' => 'ios']);
    $user->updatePushSubscription('https://push.example/1', 'k', 'a');
    expect(reminder($user, ['push'])->via($user))->toBe([ExpoChannel::class, WebPushChannel::class]);

    $unverified = User::factory()->unverified()->create();
    expect(reminder($unverified, ['email', 'in_app'])->via($unverified))->toBe(['database']);
});

it('writes localized text', function (int $days, string $title) {
    $user = User::factory()->create();
    $data = reminder($user, ['in_app'], $days)->toArray($user);

    expect($data['title'])->toBe($title)
        ->and($data['body'])->toBe('€12.99 on November 30, 2026');
})->with([
    [0, 'Netflix renews today'],
    [1, 'Netflix renews tomorrow'],
    [7, 'Netflix renews in 7 days'],
]);

it('formats zero-decimal currencies', function () {
    $user = User::factory()->create();

    expect(reminder($user, ['in_app'], 1, ['amount' => 1600, 'currency' => 'JPY'])->toArray($user)['body'])->toStartWith('¥1,600');
});

it('stores an in-app notification', function () {
    $user = User::factory()->create();
    $user->notify(reminder($user, ['in_app']));

    expect($user->notifications()->first()->data)->toMatchArray(['title' => 'Netflix renews tomorrow', 'days_before' => 1, 'payment_date' => '2026-11-30']);
});

it('sends Expo pushes and drops tokens Expo no longer knows', function () {
    Http::fake([ExpoChannel::URL => Http::response(['data' => [
        ['status' => 'ok', 'id' => 'x'],
        ['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']],
    ]])]);
    $user = User::factory()->create();
    $user->deviceTokens()->create(['token' => 'ExponentPushToken[live]', 'platform' => 'ios']);
    $user->deviceTokens()->create(['token' => 'ExponentPushToken[dead]', 'platform' => 'android']);

    $notification = reminder($user, ['push']);
    $user->notify($notification);

    Http::assertSent(fn ($request) => $request[0]['to'] === 'ExponentPushToken[live]'
        && $request[0]['title'] === 'Netflix renews tomorrow'
        && $request[0]['data']['subscription_id'] === $notification->subscription->id);
    expect(DeviceToken::pluck('token')->all())->toBe(['ExponentPushToken[live]']);
});

it('builds the email', function () {
    $user = User::factory()->create();
    $mail = reminder($user, ['email'])->toMail($user);

    expect($mail->subject)->toBe('Netflix payment reminder')
        ->and($mail->introLines[0])->toBe('Your Netflix subscription renews on November 30, 2026 for €12.99.');
});
