<?php

use App\Models\Category;
use App\Models\DeviceToken;
use App\Models\ReminderRule;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('shows and updates the profile', function () {
    actingAsUser(['name' => 'Ana']);

    $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.name', 'Ana');
    $this->patchJson('/api/v1/me', ['currency' => 'USD', 'timezone' => 'Asia/Tokyo'])
        ->assertOk()
        ->assertJsonPath('data.currency', 'USD')
        ->assertJsonPath('data.timezone', 'Asia/Tokyo');
});

it('requires the password to delete the account', function () {
    actingAsUser(['password' => 'secret-pass-1']);

    $this->deleteJson('/api/v1/me', ['password' => 'wrong'])->assertUnprocessable();
});

it('deletes the account and all its data', function () {
    $user = User::factory()->create(['password' => 'secret-pass-1']);
    $token = $user->createToken('phone')->plainTextToken;
    $service = Service::factory()->create(['user_id' => $user->id]);
    Subscription::factory()->for($user)->create(['service_id' => $service->id]);
    $user->reminderRules()->create(config('subs.default_reminder'));
    $user->deviceTokens()->create(['token' => 'expo-token', 'platform' => 'ios']);
    DB::table('notifications')->insert([
        'id' => (string) Str::uuid(), 'type' => 'x', 'notifiable_type' => User::class,
        'notifiable_id' => $user->id, 'data' => '{}', 'created_at' => now(), 'updated_at' => now(),
    ]);
    DB::table('password_reset_tokens')->insert(['email' => $user->email, 'token' => 'h', 'created_at' => now()]);

    expect($user->reminderRules()->count())->toBe(1)
        ->and($user->deviceTokens()->count())->toBe(1)
        ->and($user->notifications()->count())->toBe(1)
        ->and(DB::table('password_reset_tokens')->count())->toBe(1)
        ->and($user->tokens()->count())->toBe(1);

    $this->withToken($token)->deleteJson('/api/v1/me', ['password' => 'secret-pass-1'])->assertNoContent();

    expect(User::count())->toBe(0)
        ->and(Subscription::withTrashed()->count())->toBe(0)
        ->and(Category::whereNotNull('user_id')->count())->toBe(0)
        ->and(Service::whereNotNull('user_id')->count())->toBe(0)
        ->and(ReminderRule::count())->toBe(0)
        ->and(DeviceToken::count())->toBe(0)
        ->and(DB::table('notifications')->count())->toBe(0)
        ->and(DB::table('password_reset_tokens')->count())->toBe(0)
        ->and(DB::table('personal_access_tokens')->count())->toBe(0);

    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
});
