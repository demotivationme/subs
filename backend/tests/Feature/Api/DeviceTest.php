<?php

use App\Models\DeviceToken;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('registers an Expo token and moves it to whoever logs in on that device', function () {
    $token = 'ExponentPushToken[abc123]';
    $first = actingAsUser();
    $this->postJson('/api/v1/devices', ['token' => $token, 'platform' => 'ios'])->assertNoContent();

    $second = User::factory()->create();
    Sanctum::actingAs($second);
    $this->postJson('/api/v1/devices', ['token' => $token, 'platform' => 'ios'])->assertNoContent();

    expect(DeviceToken::count())->toBe(1)
        ->and(DeviceToken::first()->user_id)->toBe($second->id)
        ->and($first->deviceTokens()->count())->toBe(0);
});

it('rejects malformed tokens and platforms', function () {
    actingAsUser();

    $this->postJson('/api/v1/devices', ['token' => 'abc', 'platform' => 'windows'])->assertJsonValidationErrors(['token', 'platform']);
});

it('unregisters a device token', function () {
    $me = actingAsUser();
    $me->deviceTokens()->create(['token' => 'ExponentPushToken[abc]', 'platform' => 'android']);

    $this->deleteJson('/api/v1/devices/'.rawurlencode('ExponentPushToken[abc]'))->assertNoContent();

    expect($me->deviceTokens()->count())->toBe(0);
});

it('subscribes and unsubscribes a browser for web push', function () {
    $me = actingAsUser();
    $sub = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/xyz', 'keys' => ['p256dh' => 'BPk', 'auth' => 'au']];

    $this->postJson('/api/v1/webpush/subscribe', $sub)->assertNoContent();
    expect($me->pushSubscriptions()->count())->toBe(1);

    $this->deleteJson('/api/v1/webpush/subscribe', ['endpoint' => $sub['endpoint']])->assertNoContent();
    expect($me->pushSubscriptions()->count())->toBe(0);
});
