<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\SendQueuedNotifications;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Queue;
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
    Notification::assertSentTo($user, QueuedVerifyEmail::class);
});

it('queues the verification email instead of sending it during the request', function () {
    Queue::fake();

    $this->postJson('/api/v1/auth/register', registerPayload())->assertCreated();

    Queue::assertPushed(SendQueuedNotifications::class, fn ($job) => $job->notification instanceof QueuedVerifyEmail
        && $job->notification instanceof VerifyEmail);
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

it('keys the auth limiter on the client ip forwarded by a trusted proxy', function () {
    $payload = ['email' => 'ana@example.com', 'password' => 'nope', 'device_name' => 'web'];
    $from = fn (string $remote, string $client) => $this->withServerVariables(['REMOTE_ADDR' => $remote])
        ->withHeader('X-Forwarded-For', $client);

    foreach (range(1, 5) as $_) {
        $from('172.18.0.5', '203.0.113.1')->postJson('/api/v1/auth/login', $payload)->assertUnprocessable();
    }
    $from('172.18.0.5', '203.0.113.1')->postJson('/api/v1/auth/login', $payload)->assertTooManyRequests();

    // Another client behind the same proxy has its own budget for the same email.
    $from('172.18.0.5', '203.0.113.2')->postJson('/api/v1/auth/login', $payload)->assertUnprocessable();

    // An untrusted peer can't buy a fresh budget by spoofing the header.
    foreach (range(1, 5) as $i) {
        $from('198.51.100.7', "203.0.113.1{$i}")->postJson('/api/v1/auth/login', $payload)->assertUnprocessable();
    }
    $from('198.51.100.7', '203.0.113.99')->postJson('/api/v1/auth/login', $payload)->assertTooManyRequests();
});

it('limits verification resends per user', function () {
    Notification::fake();
    $ana = User::factory()->unverified()->create();
    $bob = User::factory()->unverified()->create();

    foreach (range(1, 5) as $_) {
        $this->actingAs($ana)->postJson('/api/v1/auth/email/resend')->assertNoContent();
    }
    $this->actingAs($ana)->postJson('/api/v1/auth/email/resend')->assertTooManyRequests();

    $this->actingAs($bob)->postJson('/api/v1/auth/email/resend')->assertNoContent();
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
    $oldToken = $user->createToken('x')->plainTextToken;

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ana@example.com'])->assertOk();
    Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user) {
        return str_starts_with($n->toMail($user)->actionUrl, config('subs.frontend_url').'/reset-password?token=');
    });

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'ana@example.com', 'token' => Password::createToken($user), 'password' => 'brand-new-pass-2',
    ])->assertOk();

    $this->app['auth']->forgetGuards();
    $this->withToken($oldToken)->getJson('/api/v1/me')->assertUnauthorized();

    $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'brand-new-pass-2', 'device_name' => 'web'])->assertOk();
});

it('answers forgot-password identically for unknown and known emails', function () {
    Notification::fake();
    User::factory()->create(['email' => 'ana@example.com']);

    $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ana@example.com'])->assertOk();
    $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'ghost@example.com'])->assertOk();

    expect($unknown->json())->toBe($known->json());
});

it('rejects a signed verification link with the wrong hash', function () {
    $user = User::factory()->unverified()->create();
    $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1('other@x.com')]);

    $this->get($url)->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('rejects a password reset with an invalid token', function () {
    User::factory()->create(['email' => 'ana@example.com']);

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'ana@example.com', 'token' => 'bogus', 'password' => 'brand-new-pass-2',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('rate limits the api per user', function () {
    actingAsUser();

    foreach (range(1, 120) as $_) {
        $this->getJson('/api/v1/me')->assertOk();
    }

    $this->getJson('/api/v1/me')->assertTooManyRequests();
});

it('uses the user locale when supported and falls back otherwise', function () {
    config(['subs.locales' => ['en', 'xx']]);
    actingAsUser(['locale' => 'xx']);

    $this->getJson('/api/v1/me')->assertOk();
    expect(app()->getLocale())->toBe('xx');

    $this->app['auth']->forgetGuards();
    $this->withHeader('Accept-Language', 'de')->postJson('/api/v1/auth/forgot-password', ['email' => 'a@b.co'])->assertOk();
    expect(app()->getLocale())->toBe('en');
});

it('returns 422 for array-valued emails', function () {
    $this->postJson('/api/v1/auth/login', ['email' => ['x'], 'password' => 'p', 'device_name' => 'web'])->assertUnprocessable();
    $this->postJson('/api/v1/auth/register', registerPayload(['email' => ['x']]))->assertUnprocessable();
});
