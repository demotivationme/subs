<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;

function registerPayload(array $overrides = []): array
{
    return [
        'name' => 'Ana', 'email' => 'Ana@Example.com', 'password' => 'secret-pass-1',
        'timezone' => 'Europe/Paris', 'currency' => 'EUR', 'locale' => 'en', 'device_name' => 'iPhone',
        ...$overrides,
    ];
}

it('registers a user with a token, a default reminder and a verification email', function () {
    Notification::fake();

    $response = $this->postJson('/api/v1/auth/register', registerPayload())->assertCreated();

    $user = User::firstWhere('email', 'ana@example.com');
    expect($response->json('token'))->toBeString()
        ->and($response->json('user'))->toMatchArray(['email' => 'ana@example.com', 'email_verified' => false, 'is_premium' => false])
        ->and($user->defaultReminderRules()->first())
        ->days_before->toBe(1)
        ->time_of_day->toBe('09:00')
        ->channels->toBe(['push', 'in_app']);
    Notification::assertSentTo($user, VerifyEmail::class);
});

it('falls back to English for an unsupported locale', function () {
    $this->postJson('/api/v1/auth/register', registerPayload(['locale' => 'fr']))
        ->assertCreated()
        ->assertJsonPath('user.locale', 'en');
});

it('rejects invalid registration data', function () {
    User::factory()->create(['email' => 'ana@example.com']);

    $this->postJson('/api/v1/auth/register', registerPayload(['timezone' => 'Mars/Base', 'currency' => 'euro']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email', 'timezone', 'currency']);
});

it('logs in and out', function () {
    User::factory()->create(['email' => 'ana@example.com', 'password' => 'secret-pass-1']);

    $token = $this->postJson('/api/v1/auth/login', ['email' => 'ANA@example.com', 'password' => 'secret-pass-1', 'device_name' => 'web'])
        ->assertOk()
        ->json('token');

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
});

it('rejects a wrong password', function () {
    User::factory()->create(['email' => 'ana@example.com', 'password' => 'secret-pass-1']);

    $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'nope', 'device_name' => 'web'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');
});

it('rate limits login attempts', function () {
    $payload = ['email' => 'ana@example.com', 'password' => 'nope', 'device_name' => 'web'];

    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/login', $payload)->assertUnprocessable();
    }

    $this->postJson('/api/v1/auth/login', $payload)->assertTooManyRequests();
});

it('verifies email through the signed link and redirects to the app', function () {
    $user = User::factory()->unverified()->create();
    $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1($user->email)]);

    $this->get($url)->assertRedirect(config('subs.frontend_url').'/?verified=1');

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('rejects a tampered verification link', function () {
    $user = User::factory()->unverified()->create();

    $this->get("/api/v1/auth/email/verify/{$user->id}/".sha1($user->email))->assertForbidden();
});

it('sends a reset link pointing to the app and resets the password', function () {
    Notification::fake();
    $user = User::factory()->create(['email' => 'ana@example.com']);

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ana@example.com'])->assertOk();
    Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user) {
        return str_starts_with($n->toMail($user)->actionUrl, config('subs.frontend_url').'/reset-password?token=');
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'ana@example.com', 'token' => Password::createToken($user), 'password' => 'brand-new-pass-2',
    ])->assertOk();

    $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'brand-new-pass-2', 'device_name' => 'web'])->assertOk();
});
