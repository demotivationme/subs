# Sign in with Google and Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People can create a Subs account and sign in with Google or Apple next to email and password, on iOS, Android and web.

**Architecture:** The app gets an ID token from the native (or web) Google/Apple sheet and posts it to `POST /api/v1/auth/social`. The API verifies the token against the provider's public keys, finds, links or creates the user in one transaction, and returns the same Sanctum token response as email login. Apple refresh tokens are kept (encrypted) only to revoke Apple access when an account is deleted.

**Tech Stack:** Laravel 12 / PHP 8.5 / Pest / Postgres (Docker), `firebase/php-jwt`; Expo SDK 58, Expo Router, NativeWind, TanStack Query, Jest + RNTL, `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `expo-crypto`.

**Spec:** `docs/superpowers/specs/2026-11-03-social-sign-in-design.md`

## Global Constraints

- Work on branch `dev`. Commit after every task; never push or merge. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `docker-compose.override.yml`, `backend/.env` or `app/.env`.
- Backend layering (enforced by `backend/tests/Arch/LayersTest.php`): request → DTO (`App\Data`, `final readonly`) → service → repository. Only `App\Repositories` query the database; repository contracts are interfaces named `…Repository`, implementations are `final` and named `Eloquent…Repository`, bound in `App\Providers\RepositoryServiceProvider::$bindings`. Controllers never use models or repositories.
- Backend commands run in Docker from the repo root: `docker compose exec php php artisan test --compact <filter>`, `docker compose exec php vendor/bin/pint --dirty`, `docker compose exec php composer require …`.
- App commands run in `app/`: `npx tsc --noEmit`, `npx expo lint`, `npx jest <path>`. Install native packages only with `npx expo install <pkg>`. After any `expo` command run `git checkout -- tsconfig.json` (Expo rewrites it).
- App lint forbids string literals in JSX (`i18next/no-literal-string`): hoist them into module constants or `en.json`. Read the theme with `useScheme()` from `@/theme`, never React Native's `useColorScheme`.
- App identifier: `com.alterwave.subs` (iOS bundle ID and Android package; already in `app/app.json`).
- Providers: `google`, `apple`. Buttons: iPhone Apple + Google, Android Google, web Google + Apple, none inside Expo Go.
- Secrets (`APPLE_PRIVATE_KEY`, client IDs) are entered by the user into `.env` files; never put real values in code, tests or docs.
- Before using an Expo or third-party RN API, read its docs for the installed version (`app/AGENTS.md`): `https://docs.expo.dev/versions/v58.0.0/sdk/apple-authentication/`, `…/sdk/crypto/`, and `https://react-native-google-signin.github.io/docs/original` for Google. If the installed API differs from the code below, follow the docs and keep the same exported names.

## Rulings on the spec (made while planning)

- **Start screen:** `StartScreen` is only a redirect, so the buttons go on **Login** and **Register** (and nowhere else).
- **"Default categories":** registration creates a **default reminder rule**, not categories. Social sign-up mirrors registration exactly (default reminder rule + `Registered` event; the event sends no verification email because the email is already verified).
- **`device_name`:** the endpoint also takes `device_name` (required, ≤ 100), as login and register do, to name the Sanctum token.
- **Email claim:** the verifier returns the email as optional. A returning user is found by `sub` even when the token has no email; linking or creating requires a verified email.
- **Apple client ID:** `social_accounts` also stores `apple_client_id` (the token's `aud`), because Apple revokes a refresh token only with the client ID that obtained it (bundle ID for iOS, Services ID for web).
- **Web Google:** Google Identity Services only offers its own rendered button, so the web Google button is Google's widget, not our `Button`.

## Review Focus

1. Apple sends `email_verified` as the **string** `"true"`/`"false"` (or a boolean): a string `"false"` must be rejected, a string `"true"` accepted. → Task 2 test.
2. A Google token for `Ana@Example.com` must link the existing `ana@example.com` account, not create a second one. → Task 3 test.
3. After the provider rotates keys, a token signed with a `kid` not in the cached JWKS must trigger one refetch and then succeed. → Task 2 test.
4. A returning Apple user whose token carries no `email` claim must still sign in by `sub`. → Task 3 test.
5. Typing `delete` (lower case) in the app's delete confirmation must still delete: the app upper-cases and trims before sending `DELETE`. → Task 9 test.

---

## File Structure

**Backend (`backend/`)**

| File | Responsibility |
|---|---|
| `database/migrations/2026_11_03_000001_create_social_accounts_table.php` | `social_accounts` table; `users.password` nullable |
| `app/Models/SocialAccount.php` | Eloquent model (encrypted `apple_refresh_token`) |
| `app/Enums/SocialProvider.php` | `google` / `apple` |
| `app/Data/VerifiedIdentity.php` | provider, subject, email, emailVerified, audience |
| `app/Data/NewSocialUser.php` | fields for creating a user without a password |
| `app/Data/SocialLoginInput.php` | the request as a DTO |
| `app/Data/AppleToken.php` | refresh token + client ID, for revocation |
| `app/Repositories/SocialAccountRepository.php` + `EloquentSocialAccountRepository.php` | find / link / update social accounts |
| `app/Repositories/UserRepository.php` (+ Eloquent) | adds `createVerified()` |
| `app/Services/Identity/IdentityTokenVerifier.php` | interface: `verify(string $idToken, ?string $nonce): VerifiedIdentity` |
| `app/Services/Identity/JwksKeys.php` | fetches and caches a provider's JWKS |
| `app/Services/Identity/GoogleTokenVerifier.php`, `AppleTokenVerifier.php` | provider rules |
| `app/Services/Identity/InvalidIdentityToken.php`, `IdentityProviderUnavailable.php` | exceptions |
| `app/Services/Identity/AppleTokenClient.php` | client-secret JWT, code exchange, revoke |
| `app/Services/SocialAuthService.php` | find-or-link-or-create, issue token |
| `app/Jobs/RevokeAppleTokens.php` | queued, encrypted revocation |
| `app/Http/Requests/SocialLoginRequest.php`, `DeleteAccountRequest.php` | validation |
| `app/Http/Controllers/Api/V1/AuthController.php` | `social()` action |
| `app/Http/Resources/UserResource.php` | `has_password` |
| `app/Services/AccountService.php` | queue revocation on delete |
| `config/services.php`, `.env.example`, `lang/en/auth.php`, `routes/api.php` | wiring |
| `tests/Feature/Identity/TokenVerifierTest.php`, `tests/Feature/Api/SocialAuthTest.php`, `tests/Feature/Api/MeTest.php`, `tests/Support/IdentityTokens.php` | tests |

**App (`app/`)**

| File | Responsibility |
|---|---|
| `src/auth/social/types.ts` | `SocialCredential`, `SocialOutcome` |
| `src/auth/social/config.ts` | public client IDs, `inExpoGo()` |
| `src/auth/social/nonce.ts` | raw + SHA-256 nonce |
| `src/auth/social/useSocialLogin.ts` | posts the credential, signs in |
| `src/auth/social/google.ts` / `google.web.ts` | Google sheet (native) / Google Identity Services (web) |
| `src/auth/social/apple.ts` / `apple.web.ts` | Apple sheet (iOS) / Sign in with Apple JS (web) |
| `src/components/SocialButtons.tsx` / `SocialButtons.web.tsx` | the buttons, divider, spinner, error |
| `src/api/auth.ts`, `src/api/types.ts`, `src/api/me.ts` | `social()`, `has_password`, delete body |
| `src/screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`, `src/screens/SettingsScreen.tsx` | use the above |
| `app.config.ts` | plugins from env, `FREE_SIGNING` |
| `jest.setup.ts` | mocks for the three native libraries |
| `README.md` (repo root) | console setup |

---

### Task 1: Social accounts schema and repositories

**Files:**
- Create: `backend/database/migrations/2026_11_03_000001_create_social_accounts_table.php`, `backend/app/Models/SocialAccount.php`, `backend/app/Enums/SocialProvider.php`, `backend/app/Data/VerifiedIdentity.php`, `backend/app/Data/NewSocialUser.php`, `backend/app/Data/AppleToken.php`, `backend/app/Repositories/SocialAccountRepository.php`, `backend/app/Repositories/EloquentSocialAccountRepository.php`
- Modify: `backend/app/Repositories/UserRepository.php`, `backend/app/Repositories/EloquentUserRepository.php`, `backend/app/Providers/RepositoryServiceProvider.php`, `backend/app/Models/User.php`
- Test: `backend/tests/Feature/Models/SocialAccountRepositoryTest.php`

**Interfaces:**
- Produces:
  - `enum SocialProvider: string { case Google = 'google'; case Apple = 'apple'; }`
  - `VerifiedIdentity(SocialProvider $provider, string $subject, ?string $email, bool $emailVerified, string $audience)`
  - `NewSocialUser(string $name, string $email, string $timezone, string $currency, string $locale)`
  - `AppleToken(string $refreshToken, string $clientId)`
  - `SocialAccountRepository::find(SocialProvider $provider, string $subject): ?SocialAccount` (with `user` loaded)
  - `SocialAccountRepository::link(User $user, VerifiedIdentity $identity): SocialAccount`
  - `SocialAccountRepository::updateEmail(SocialAccount $account, ?string $email): void`
  - `SocialAccountRepository::storeAppleToken(SocialAccount $account, AppleToken $token): void`
  - `SocialAccountRepository::appleTokensFor(User $user): list<AppleToken>`
  - `UserRepository::createVerified(NewSocialUser $input): User`
  - `User::socialAccounts(): HasMany`

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Models/SocialAccountRepositoryTest.php`:

```php
<?php

use App\Data\AppleToken;
use App\Data\NewSocialUser;
use App\Data\VerifiedIdentity;
use App\Enums\SocialProvider;
use App\Models\User;
use App\Repositories\SocialAccountRepository;
use App\Repositories\UserRepository;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

function identity(string $subject = 'sub-1', SocialProvider $provider = SocialProvider::Google): VerifiedIdentity
{
    return new VerifiedIdentity($provider, $subject, 'ana@example.com', true, 'client-id');
}

it('creates a verified user without a password', function () {
    $user = app(UserRepository::class)->createVerified(new NewSocialUser('Ana', 'Ana@Example.com', 'Europe/Paris', 'EUR', 'en'));

    expect($user->email)->toBe('ana@example.com')
        ->and($user->password)->toBeNull()
        ->and($user->hasVerifiedEmail())->toBeTrue();
});

it('links an identity and finds it again with its user', function () {
    $user = User::factory()->create();
    $repo = app(SocialAccountRepository::class);

    $repo->link($user, identity());

    $found = $repo->find(SocialProvider::Google, 'sub-1');
    expect($found->user->is($user))->toBeTrue()
        ->and($found->email)->toBe('ana@example.com')
        ->and($repo->find(SocialProvider::Apple, 'sub-1'))->toBeNull();
});

it('refuses the same identity twice', function () {
    $repo = app(SocialAccountRepository::class);
    $repo->link(User::factory()->create(), identity());

    $repo->link(User::factory()->create(), identity());
})->throws(UniqueConstraintViolationException::class);

it('stores Apple refresh tokens encrypted and lists them for a user', function () {
    $user = User::factory()->create();
    $repo = app(SocialAccountRepository::class);
    $account = $repo->link($user, identity('apple-sub', SocialProvider::Apple));

    $repo->storeAppleToken($account, new AppleToken('refresh-1', 'com.alterwave.subs'));

    expect(DB::table('social_accounts')->value('apple_refresh_token'))->not->toBe('refresh-1')
        ->and($repo->appleTokensFor($user))->toEqual([new AppleToken('refresh-1', 'com.alterwave.subs')]);
});

it('deletes social accounts with their user', function () {
    $user = User::factory()->create();
    app(SocialAccountRepository::class)->link($user, identity());

    app(UserRepository::class)->delete($user);

    expect(DB::table('social_accounts')->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php php artisan test --compact --filter=SocialAccountRepositoryTest`
Expected: FAIL (`Class "App\Data\AppleToken" not found` or similar).

- [ ] **Step 3: Implement**

`backend/database/migrations/2026_11_03_000001_create_social_accounts_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
        });

        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 16);
            $table->string('provider_user_id');
            $table->string('email')->nullable();
            $table->text('apple_refresh_token')->nullable();
            $table->string('apple_client_id')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_user_id']);
            $table->unique(['user_id', 'provider']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
```

(`down` leaves `users.password` nullable: rows without a password may exist by then.)

`backend/app/Enums/SocialProvider.php`:

```php
<?php

namespace App\Enums;

enum SocialProvider: string
{
    case Google = 'google';
    case Apple = 'apple';
}
```

`backend/app/Data/VerifiedIdentity.php`:

```php
<?php

namespace App\Data;

use App\Enums\SocialProvider;

/** What a provider's verified ID token says about the person. */
final readonly class VerifiedIdentity
{
    public function __construct(
        public SocialProvider $provider,
        public string $subject,
        public ?string $email,
        public bool $emailVerified,
        public string $audience,
    ) {}
}
```

`backend/app/Data/NewSocialUser.php`:

```php
<?php

namespace App\Data;

/** A user created through Google or Apple: verified email, no password. */
final readonly class NewSocialUser
{
    public function __construct(
        public string $name,
        public string $email,
        public string $timezone,
        public string $currency,
        public string $locale,
    ) {}
}
```

`backend/app/Data/AppleToken.php`:

```php
<?php

namespace App\Data;

/** An Apple refresh token and the client ID that obtained it; Apple revokes it only with that ID. */
final readonly class AppleToken
{
    public function __construct(
        public string $refreshToken,
        public string $clientId,
    ) {}
}
```

`backend/app/Models/SocialAccount.php`:

```php
<?php

namespace App\Models;

use App\Enums\SocialProvider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAccount extends Model
{
    protected $fillable = ['user_id', 'provider', 'provider_user_id', 'email', 'apple_refresh_token', 'apple_client_id'];

    protected $hidden = ['apple_refresh_token'];

    protected function casts(): array
    {
        return ['provider' => SocialProvider::class, 'apple_refresh_token' => 'encrypted'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

In `backend/app/Models/User.php`, add next to the other relations:

```php
    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }
```

`backend/app/Repositories/SocialAccountRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Data\AppleToken;
use App\Data\VerifiedIdentity;
use App\Enums\SocialProvider;
use App\Models\SocialAccount;
use App\Models\User;

/** Google and Apple identities linked to users. */
interface SocialAccountRepository
{
    /** With its user loaded. */
    public function find(SocialProvider $provider, string $subject): ?SocialAccount;

    /** @throws \Illuminate\Database\UniqueConstraintViolationException when the identity is already linked */
    public function link(User $user, VerifiedIdentity $identity): SocialAccount;

    public function updateEmail(SocialAccount $account, ?string $email): void;

    public function storeAppleToken(SocialAccount $account, AppleToken $token): void;

    /** @return list<AppleToken> */
    public function appleTokensFor(User $user): array;
}
```

`backend/app/Repositories/EloquentSocialAccountRepository.php`:

```php
<?php

namespace App\Repositories;

use App\Data\AppleToken;
use App\Data\VerifiedIdentity;
use App\Enums\SocialProvider;
use App\Models\SocialAccount;
use App\Models\User;

final class EloquentSocialAccountRepository implements SocialAccountRepository
{
    public function find(SocialProvider $provider, string $subject): ?SocialAccount
    {
        return SocialAccount::with('user')->where('provider', $provider)->where('provider_user_id', $subject)->first();
    }

    public function link(User $user, VerifiedIdentity $identity): SocialAccount
    {
        return SocialAccount::create([
            'user_id' => $user->id,
            'provider' => $identity->provider,
            'provider_user_id' => $identity->subject,
            'email' => $identity->email === null ? null : mb_strtolower($identity->email),
        ])->setRelation('user', $user);
    }

    public function updateEmail(SocialAccount $account, ?string $email): void
    {
        if ($email !== null) {
            $account->update(['email' => mb_strtolower($email)]);
        }
    }

    public function storeAppleToken(SocialAccount $account, AppleToken $token): void
    {
        $account->update(['apple_refresh_token' => $token->refreshToken, 'apple_client_id' => $token->clientId]);
    }

    public function appleTokensFor(User $user): array
    {
        return $user->socialAccounts()
            ->where('provider', SocialProvider::Apple)
            ->whereNotNull('apple_refresh_token')
            ->get()
            ->map(fn (SocialAccount $a) => new AppleToken($a->apple_refresh_token, $a->apple_client_id))
            ->values()
            ->all();
    }
}
```

In `backend/app/Repositories/UserRepository.php`, add (with `use App\Data\NewSocialUser;`):

```php
    /** A user with a verified email and no password (Google/Apple sign-up). */
    public function createVerified(NewSocialUser $input): User;
```

In `backend/app/Repositories/EloquentUserRepository.php` (with `use App\Data\NewSocialUser;`):

```php
    public function createVerified(NewSocialUser $input): User
    {
        $user = User::create([
            'name' => $input->name,
            'email' => mb_strtolower($input->email),
            'timezone' => $input->timezone,
            'currency' => $input->currency,
            'locale' => $input->locale,
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }
```

In `backend/app/Providers/RepositoryServiceProvider.php` add the imports and the binding `SocialAccountRepository::class => EloquentSocialAccountRepository::class,`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `docker compose exec php php artisan migrate && docker compose exec php php artisan test --compact --filter='SocialAccountRepositoryTest|LayersTest'`
Expected: PASS. If `->change()` complains, the project's Laravel version supports it natively (no doctrine/dbal needed on Laravel 11+); fix the column definition, not the approach.

- [ ] **Step 5: Commit**

```bash
docker compose exec php vendor/bin/pint --dirty
git add backend && git commit -m "feat(api): social accounts table and repository

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Verifying Google and Apple ID tokens

**Files:**
- Create: `backend/app/Services/Identity/IdentityTokenVerifier.php`, `JwksKeys.php`, `GoogleTokenVerifier.php`, `AppleTokenVerifier.php`, `InvalidIdentityToken.php`, `IdentityProviderUnavailable.php`, `backend/tests/Support/IdentityTokens.php`
- Modify: `backend/composer.json` (via composer), `backend/config/services.php`, `backend/.env.example`, `backend/tests/Pest.php`
- Test: `backend/tests/Feature/Identity/TokenVerifierTest.php`

**Interfaces:**
- Consumes: `VerifiedIdentity`, `SocialProvider` (Task 1).
- Produces:
  - `interface IdentityTokenVerifier { public function verify(string $idToken, ?string $nonce = null): VerifiedIdentity; }` — throws `InvalidIdentityToken` or `IdentityProviderUnavailable`.
  - `GoogleTokenVerifier`, `AppleTokenVerifier` (both implement it).
  - `JwksKeys::for(string $url, bool $refresh = false): array<string, \Firebase\JWT\Key>`
  - Config: `services.google.client_ids` (list), `services.apple.client_ids` (list), `services.apple.team_id`, `services.apple.key_id`, `services.apple.private_key`.
  - Test helpers (global functions from `tests/Support/IdentityTokens.php`): `fakeIdentityProviders(): void`, `googleToken(array $claims = [], ?string $kid = null): string`, `appleToken(array $claims = [], ?string $kid = null): string`, constants `GOOGLE_CLIENT = 'google-web-client'`, `APPLE_CLIENT = 'com.alterwave.subs'`, `TEST_NONCE = 'raw-nonce'`.

- [ ] **Step 1: Install the JWT library and add config**

```bash
docker compose exec php composer require firebase/php-jwt:^7.0
```

Append to `backend/config/services.php` before the closing `];`:

```php
    'google' => [
        // Web, iOS and Android OAuth client IDs; a token's `aud` must be one of them.
        'client_ids' => array_values(array_filter(explode(',', (string) env('GOOGLE_CLIENT_IDS', '')))),
    ],

    'apple' => [
        // The iOS bundle ID and the web Services ID.
        'client_ids' => array_values(array_filter(explode(',', (string) env('APPLE_CLIENT_IDS', '')))),
        'team_id' => env('APPLE_TEAM_ID'),
        'key_id' => env('APPLE_KEY_ID'),
        // The .p8 key's contents, or a path to the file.
        'private_key' => env('APPLE_PRIVATE_KEY'),
    ],
```

Append to `backend/.env.example`:

```
# Sign in with Google / Apple (see README → "Sign in with Google and Apple")
GOOGLE_CLIENT_IDS=
APPLE_CLIENT_IDS=com.alterwave.subs
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

- [ ] **Step 2: Write the test helpers**

`backend/tests/Support/IdentityTokens.php`:

```php
<?php

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;

const GOOGLE_CLIENT = 'google-web-client';
const APPLE_CLIENT = 'com.alterwave.subs';
const TEST_NONCE = 'raw-nonce';
const TEST_KID = 'test-kid';

/** One RSA key pair per test run signs every fake ID token. */
function testSigningKey(): OpenSSLAsymmetricKey
{
    static $key;

    return $key ??= openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
}

/** @return array{keys: list<array<string, string>>} */
function testJwks(string $kid = TEST_KID): array
{
    $rsa = openssl_pkey_get_details(testSigningKey())['rsa'];
    $b64 = fn (string $v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');

    return ['keys' => [['kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'kid' => $kid, 'n' => $b64($rsa['n']), 'e' => $b64($rsa['e'])]]];
}

/** Serves the test JWKS for both providers and sets the client IDs the API accepts. */
function fakeIdentityProviders(string $kid = TEST_KID): void
{
    config([
        'services.google.client_ids' => [GOOGLE_CLIENT, 'google-ios-client'],
        'services.apple.client_ids' => [APPLE_CLIENT, 'com.alterwave.subs.web'],
    ]);
    Http::fake([
        'www.googleapis.com/oauth2/v3/certs' => Http::response(testJwks($kid)),
        'appleid.apple.com/auth/keys' => Http::response(testJwks($kid)),
    ]);
}

function signTestToken(array $claims, string $kid): string
{
    openssl_pkey_export(testSigningKey(), $pem);

    return JWT::encode($claims, $pem, 'RS256', $kid);
}

function googleToken(array $claims = [], string $kid = TEST_KID): string
{
    return signTestToken([
        'iss' => 'https://accounts.google.com', 'aud' => GOOGLE_CLIENT, 'sub' => 'google-sub-1',
        'email' => 'ana@example.com', 'email_verified' => true, 'iat' => time(), 'exp' => time() + 3600,
        ...$claims,
    ], $kid);
}

function appleToken(array $claims = [], string $kid = TEST_KID): string
{
    return signTestToken([
        'iss' => 'https://appleid.apple.com', 'aud' => APPLE_CLIENT, 'sub' => 'apple-sub-1',
        'email' => 'ana@example.com', 'email_verified' => 'true', 'nonce' => hash('sha256', TEST_NONCE),
        'iat' => time(), 'exp' => time() + 3600,
        ...$claims,
    ], $kid);
}
```

In `backend/tests/Pest.php`, after the `use` lines at the top of the helpers section, add:

```php
require_once __DIR__.'/Support/IdentityTokens.php';
```

- [ ] **Step 3: Write the failing tests**

`backend/tests/Feature/Identity/TokenVerifierTest.php`:

```php
<?php

use App\Enums\SocialProvider;
use App\Services\Identity\AppleTokenVerifier;
use App\Services\Identity\GoogleTokenVerifier;
use App\Services\Identity\IdentityProviderUnavailable;
use App\Services\Identity\InvalidIdentityToken;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => fakeIdentityProviders());

it('accepts a valid Google token', function () {
    $identity = app(GoogleTokenVerifier::class)->verify(googleToken());

    expect($identity)
        ->provider->toBe(SocialProvider::Google)
        ->subject->toBe('google-sub-1')
        ->email->toBe('ana@example.com')
        ->emailVerified->toBeTrue()
        ->audience->toBe(GOOGLE_CLIENT);
});

it('accepts Google tokens for any configured client and either issuer spelling', function () {
    $identity = app(GoogleTokenVerifier::class)->verify(googleToken(['aud' => 'google-ios-client', 'iss' => 'accounts.google.com']));

    expect($identity->audience)->toBe('google-ios-client');
});

it('rejects a Google token with a wrong audience, issuer, expiry or signature', function (array $claims, bool $tamper) {
    $token = googleToken($claims);
    if ($tamper) {
        $token = substr($token, 0, -4).'AAAA';
    }

    app(GoogleTokenVerifier::class)->verify($token);
})->with([
    'wrong audience' => [['aud' => 'someone-else'], false],
    'wrong issuer' => [['iss' => 'https://evil.example'], false],
    'expired' => [['exp' => time() - 120], false],
    'tampered signature' => [[], true],
])->throws(InvalidIdentityToken::class);

it('accepts a valid Apple token with the matching nonce', function () {
    $identity = app(AppleTokenVerifier::class)->verify(appleToken(), TEST_NONCE);

    expect($identity)->provider->toBe(SocialProvider::Apple)->subject->toBe('apple-sub-1')->emailVerified->toBeTrue();
});

it('rejects an Apple token without the matching nonce', function (?string $nonce) {
    app(AppleTokenVerifier::class)->verify(appleToken(), $nonce);
})->with(['wrong' => 'other-nonce', 'missing' => null])->throws(InvalidIdentityToken::class);

it('reads Apple email_verified as a string or a boolean', function (mixed $flag, bool $expected) {
    $identity = app(AppleTokenVerifier::class)->verify(appleToken(['email_verified' => $flag]), TEST_NONCE);

    expect($identity->emailVerified)->toBe($expected);
})->with([
    'string true' => ['true', true],
    'string false' => ['false', false],
    'bool true' => [true, true],
    'bool false' => [false, false],
]);

it('allows a token without an email', function () {
    $token = signTestToken(['iss' => 'https://appleid.apple.com', 'aud' => APPLE_CLIENT, 'sub' => 'apple-sub-1',
        'nonce' => hash('sha256', TEST_NONCE), 'iat' => time(), 'exp' => time() + 3600], TEST_KID);

    $identity = app(AppleTokenVerifier::class)->verify($token, TEST_NONCE);

    expect($identity->email)->toBeNull()->and($identity->emailVerified)->toBeFalse();
});

it('caches the keys between verifications', function () {
    app(GoogleTokenVerifier::class)->verify(googleToken());
    app(GoogleTokenVerifier::class)->verify(googleToken());

    Http::assertSentCount(1);
});

it('refetches the keys once for an unknown key id', function () {
    app(GoogleTokenVerifier::class)->verify(googleToken()); // caches the JWKS with "test-kid"
    fakeIdentityProviders('rotated-kid');                  // the provider now publishes another key id

    $identity = app(GoogleTokenVerifier::class)->verify(googleToken(kid: 'rotated-kid'));

    expect($identity->subject)->toBe('google-sub-1');
});

it('reports the provider as unavailable when its keys cannot be fetched', function () {
    Http::fake(['www.googleapis.com/*' => Http::response('', 500)]);

    app(GoogleTokenVerifier::class)->verify(googleToken());
})->throws(IdentityProviderUnavailable::class);

it('rejects garbage', function () {
    app(GoogleTokenVerifier::class)->verify('not-a-jwt');
})->throws(InvalidIdentityToken::class);
```

Note: `Http::fake` called twice registers both stubs; Laravel uses the most recently registered matching stub first only if called with `Http::fake()` again after `Http::preventStrayRequests` is not set — if the second fake does not override the first in this Laravel version, change `fakeIdentityProviders()` to start with `Http::swap(new \Illuminate\Http\Client\Factory)` before `Http::fake(...)`. Do not change the test's intent.

- [ ] **Step 4: Run them to verify they fail**

Run: `docker compose exec php php artisan test --compact --filter=TokenVerifierTest`
Expected: FAIL (`Class "App\Services\Identity\GoogleTokenVerifier" not found`).

- [ ] **Step 5: Implement**

`backend/app/Services/Identity/InvalidIdentityToken.php`:

```php
<?php

namespace App\Services\Identity;

use RuntimeException;

/** The token is not a valid ID token from the provider for this app. */
final class InvalidIdentityToken extends RuntimeException {}
```

`backend/app/Services/Identity/IdentityProviderUnavailable.php`:

```php
<?php

namespace App\Services\Identity;

use RuntimeException;

/** The provider's signing keys could not be fetched. */
final class IdentityProviderUnavailable extends RuntimeException {}
```

`backend/app/Services/Identity/IdentityTokenVerifier.php`:

```php
<?php

namespace App\Services\Identity;

use App\Data\VerifiedIdentity;

interface IdentityTokenVerifier
{
    /**
     * @param  string|null  $nonce  the raw nonce the app generated (Apple)
     *
     * @throws InvalidIdentityToken
     * @throws IdentityProviderUnavailable
     */
    public function verify(string $idToken, ?string $nonce = null): VerifiedIdentity;
}
```

`backend/app/Services/Identity/JwksKeys.php`:

```php
<?php

namespace App\Services\Identity;

use Firebase\JWT\JWK;
use Firebase\JWT\Key;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/** A provider's published signing keys, cached for an hour. */
final class JwksKeys
{
    private const TTL = 3600;

    /** @return array<string, Key> keyed by key id */
    public function for(string $url, bool $refresh = false): array
    {
        $cacheKey = 'jwks:'.sha1($url);
        if ($refresh) {
            Cache::forget($cacheKey);
        }

        $jwks = Cache::remember($cacheKey, self::TTL, function () use ($url) {
            try {
                $response = Http::acceptJson()->timeout(10)->get($url);
            } catch (ConnectionException $e) {
                throw new IdentityProviderUnavailable($e->getMessage(), previous: $e);
            }
            if (! $response->successful() || ! is_array($response->json('keys'))) {
                throw new IdentityProviderUnavailable("Could not fetch {$url}");
            }

            return $response->json();
        });

        return JWK::parseKeySet($jwks, 'RS256');
    }
}
```

Shared decoding lives in a small abstract base so both verifiers stay short. `backend/app/Services/Identity/JwtIdentityVerifier.php` (add it to the Create list):

```php
<?php

namespace App\Services\Identity;

use App\Data\VerifiedIdentity;
use App\Enums\SocialProvider;
use Firebase\JWT\JWT;
use Throwable;

/** Signature, issuer, audience and expiry checks shared by Google and Apple. */
abstract class JwtIdentityVerifier implements IdentityTokenVerifier
{
    public function __construct(private readonly JwksKeys $jwks) {}

    abstract protected function provider(): SocialProvider;

    abstract protected function jwksUrl(): string;

    /** @return list<string> */
    abstract protected function issuers(): array;

    /** @return list<string> */
    abstract protected function audiences(): array;

    /** Provider-specific claim checks; throw InvalidIdentityToken to reject. */
    protected function checkClaims(object $claims, ?string $nonce): void {}

    public function verify(string $idToken, ?string $nonce = null): VerifiedIdentity
    {
        $claims = $this->decode($idToken);

        if (! in_array($claims->iss ?? null, $this->issuers(), true)) {
            throw new InvalidIdentityToken('Unexpected issuer.');
        }
        $audience = $claims->aud ?? null;
        if (! is_string($audience) || ! in_array($audience, $this->audiences(), true)) {
            throw new InvalidIdentityToken('Unexpected audience.');
        }
        if (! is_string($claims->sub ?? null) || $claims->sub === '') {
            throw new InvalidIdentityToken('Missing subject.');
        }
        $this->checkClaims($claims, $nonce);

        $email = is_string($claims->email ?? null) && $claims->email !== '' ? $claims->email : null;

        return new VerifiedIdentity(
            $this->provider(),
            $claims->sub,
            $email,
            $email !== null && filter_var($claims->email_verified ?? false, FILTER_VALIDATE_BOOL),
            $audience,
        );
    }

    private function decode(string $idToken): object
    {
        $kid = $this->keyId($idToken);
        $keys = $this->jwks->for($this->jwksUrl());
        if (! isset($keys[$kid])) {
            // The provider may have rotated its keys since we cached them.
            $keys = $this->jwks->for($this->jwksUrl(), refresh: true);
        }
        if (! isset($keys[$kid])) {
            throw new InvalidIdentityToken('Unknown signing key.');
        }

        JWT::$leeway = 60;
        try {
            return JWT::decode($idToken, $keys[$kid]);
        } catch (Throwable $e) {
            throw new InvalidIdentityToken($e->getMessage(), previous: $e);
        }
    }

    private function keyId(string $idToken): string
    {
        $parts = explode('.', $idToken);
        try {
            $header = count($parts) === 3 ? JWT::jsonDecode(JWT::urlsafeB64Decode($parts[0])) : null;
        } catch (Throwable) {
            $header = null;
        }
        if (! is_object($header) || ! is_string($header->kid ?? null)) {
            throw new InvalidIdentityToken('Malformed token.');
        }

        return $header->kid;
    }
}
```

`backend/app/Services/Identity/GoogleTokenVerifier.php`:

```php
<?php

namespace App\Services\Identity;

use App\Enums\SocialProvider;

final class GoogleTokenVerifier extends JwtIdentityVerifier
{
    protected function provider(): SocialProvider
    {
        return SocialProvider::Google;
    }

    protected function jwksUrl(): string
    {
        return 'https://www.googleapis.com/oauth2/v3/certs';
    }

    protected function issuers(): array
    {
        return ['accounts.google.com', 'https://accounts.google.com'];
    }

    protected function audiences(): array
    {
        return config('services.google.client_ids');
    }
}
```

`backend/app/Services/Identity/AppleTokenVerifier.php`:

```php
<?php

namespace App\Services\Identity;

use App\Enums\SocialProvider;

final class AppleTokenVerifier extends JwtIdentityVerifier
{
    protected function provider(): SocialProvider
    {
        return SocialProvider::Apple;
    }

    protected function jwksUrl(): string
    {
        return 'https://appleid.apple.com/auth/keys';
    }

    protected function issuers(): array
    {
        return ['https://appleid.apple.com'];
    }

    protected function audiences(): array
    {
        return config('services.apple.client_ids');
    }

    /** The app hashed its raw nonce into the request; a replayed token carries someone else's. */
    protected function checkClaims(object $claims, ?string $nonce): void
    {
        if ($nonce === null || ! is_string($claims->nonce ?? null) || ! hash_equals(hash('sha256', $nonce), $claims->nonce)) {
            throw new InvalidIdentityToken('Nonce mismatch.');
        }
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `docker compose exec php php artisan test --compact --filter='TokenVerifierTest|LayersTest'`
Expected: PASS. Tests use the array cache driver (`phpunit.xml`), so each test starts with an empty JWKS cache; if `caches the keys` sees 2 requests, check `CACHE_STORE` in `phpunit.xml` is `array`.

- [ ] **Step 7: Commit**

```bash
docker compose exec php vendor/bin/pint --dirty
git add backend && git commit -m "feat(api): verify Google and Apple ID tokens against their published keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sign-in endpoint

**Files:**
- Create: `backend/app/Data/SocialLoginInput.php`, `backend/app/Http/Requests/SocialLoginRequest.php`, `backend/app/Services/SocialAuthService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/AuthController.php`, `backend/routes/api.php`, `backend/lang/en/auth.php`
- Test: `backend/tests/Feature/Api/SocialAuthTest.php`, `backend/tests/Feature/Api/AuthTest.php`

**Interfaces:**
- Consumes: `SocialAccountRepository`, `UserRepository::createVerified`, `NewSocialUser`, `VerifiedIdentity` (Task 1); `GoogleTokenVerifier`, `AppleTokenVerifier`, `InvalidIdentityToken`, `IdentityProviderUnavailable` (Task 2); existing `IssuedToken`, `ReminderRuleRepository::save`, `ReminderRuleInput`, `TransactionRunner`, `UserRepository::issueToken/markEmailVerified/findByEmail`.
- Produces:
  - `POST /api/v1/auth/social` → `200 {token, user}` (as login).
  - `SocialLoginInput(SocialProvider $provider, string $idToken, ?string $nonce, ?string $authorizationCode, ?string $name, string $timezone, string $currency, string $locale, string $deviceName)`
  - `SocialAuthService::signIn(SocialLoginInput $input): IssuedToken`
  - `protected SocialAuthService::afterAppleSignIn(SocialAccount $account, SocialLoginInput $input, VerifiedIdentity $identity): void` — an empty hook here; Task 4 fills it.
  - Lang keys `auth.social_invalid`, `auth.social_unavailable`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/Api/SocialAuthTest.php`:

```php
<?php

use App\Models\User;
use App\Services\SocialAuthService;
use App\Data\SocialLoginInput;
use App\Enums\SocialProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => fakeIdentityProviders());

function socialPayload(array $overrides = []): array
{
    return [
        'provider' => 'google', 'id_token' => googleToken(),
        'timezone' => 'Europe/Paris', 'currency' => 'EUR', 'locale' => 'en', 'device_name' => 'iPhone',
        ...$overrides,
    ];
}

it('creates a verified account with the default reminder on the first Google sign-in', function () {
    $response = $this->postJson('/api/v1/auth/social', socialPayload())->assertOk();

    $user = User::firstWhere('email', 'ana@example.com');
    expect($response->json('token'))->toBeString()
        ->and($response->json('user'))->toMatchArray(['email' => 'ana@example.com', 'email_verified' => true, 'currency' => 'EUR'])
        ->and($user->password)->toBeNull()
        ->and($user->name)->toBe('ana')
        ->and($user->defaultReminderRules()->count())->toBe(1)
        ->and(DB::table('social_accounts')->where(['provider' => 'google', 'provider_user_id' => 'google-sub-1'])->exists())->toBeTrue();
});

it('signs a returning user in to the same account', function () {
    $this->postJson('/api/v1/auth/social', socialPayload())->assertOk();
    $this->postJson('/api/v1/auth/social', socialPayload(['id_token' => googleToken(['email' => 'new@example.com'])]))->assertOk();

    expect(User::count())->toBe(1)
        ->and(DB::table('social_accounts')->value('email'))->toBe('new@example.com');
});

it('links an existing password account with the same email, whatever its case', function () {
    $existing = User::factory()->unverified()->create(['email' => 'ana@example.com', 'password' => 'secret-pass-1']);

    $this->postJson('/api/v1/auth/social', socialPayload(['id_token' => googleToken(['email' => 'Ana@Example.com'])]))
        ->assertOk()
        ->assertJsonPath('user.id', $existing->id)
        ->assertJsonPath('user.email_verified', true);

    expect(User::count())->toBe(1);
    $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'secret-pass-1', 'device_name' => 'Mac'])->assertOk();
});

it('signs a returning Apple user in by subject even without an email claim', function () {
    $this->postJson('/api/v1/auth/social', socialPayload(['provider' => 'apple', 'id_token' => appleToken(), 'nonce' => TEST_NONCE]))->assertOk();
    $noEmail = signTestToken(['iss' => 'https://appleid.apple.com', 'aud' => APPLE_CLIENT, 'sub' => 'apple-sub-1',
        'nonce' => hash('sha256', TEST_NONCE), 'iat' => time(), 'exp' => time() + 3600], TEST_KID);

    $this->postJson('/api/v1/auth/social', socialPayload(['provider' => 'apple', 'id_token' => $noEmail, 'nonce' => TEST_NONCE]))->assertOk();

    expect(User::count())->toBe(1);
});

it('saves the name Apple sends on the first authorisation', function () {
    $this->postJson('/api/v1/auth/social', socialPayload([
        'provider' => 'apple', 'id_token' => appleToken(), 'nonce' => TEST_NONCE, 'name' => 'Ana María',
    ]))->assertOk()->assertJsonPath('user.name', 'Ana María');
});

it('rejects an unverified email for a new account', function () {
    $this->postJson('/api/v1/auth/social', socialPayload(['id_token' => googleToken(['email_verified' => false])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['id_token' => "We couldn't verify your sign-in. Please try again."]);

    expect(User::count())->toBe(0);
});

it('rejects an invalid token', function () {
    $this->postJson('/api/v1/auth/social', socialPayload(['id_token' => googleToken(['aud' => 'someone-else'])]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('id_token');
});

it('requires the nonce for Apple', function () {
    $this->postJson('/api/v1/auth/social', socialPayload(['provider' => 'apple', 'id_token' => appleToken()]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('nonce');
});

it('validates the payload', function () {
    $this->postJson('/api/v1/auth/social', ['provider' => 'facebook'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['provider', 'id_token', 'timezone', 'currency', 'device_name']);
});

it('answers 503 when the provider cannot be reached', function () {
    Http::fake(['www.googleapis.com/*' => Http::response('', 500)]);

    $this->postJson('/api/v1/auth/social', socialPayload())
        ->assertStatus(503)
        ->assertJsonPath('message', 'Sign-in is temporarily unavailable. Please try again.');
});

it('ends a sign-in that loses a race for the same identity in the winner\'s account', function () {
    // Simulate the other request winning between our lookup and our insert.
    $winner = User::factory()->create(['email' => 'ana@example.com']);
    DB::table('social_accounts')->insert(['user_id' => $winner->id, 'provider' => 'google', 'provider_user_id' => 'google-sub-1',
        'created_at' => now(), 'updated_at' => now()]);

    $issued = app(SocialAuthService::class)->signIn(new SocialLoginInput(
        SocialProvider::Google, googleToken(), null, null, null, 'Europe/Paris', 'EUR', 'en', 'iPhone',
    ));

    expect($issued->user->is($winner))->toBeTrue()->and(User::count())->toBe(1);
});
```

(The race test exercises the retry path only partly — the account already exists, so the first lookup finds it. The real guard is the unique index plus the retry in `signIn`; keep both.)

Add to `backend/tests/Feature/Api/AuthTest.php`:

```php
it('refuses a password login for an account that has no password', function () {
    User::factory()->create(['email' => 'ana@example.com', 'password' => null]);

    $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'anything-1', 'device_name' => 'Mac'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email' => __('auth.failed')]);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php php artisan test --compact --filter='SocialAuthTest|AuthTest'`
Expected: SocialAuthTest FAILS with 404s; the new AuthTest case already PASSES (`Hash::check` returns false for a null hash) — keep it as a guard.

- [ ] **Step 3: Implement**

`backend/lang/en/auth.php`, add after `'throttle'`:

```php
    'social_invalid' => "We couldn't verify your sign-in. Please try again.",
    'social_unavailable' => 'Sign-in is temporarily unavailable. Please try again.',
```

`backend/app/Data/SocialLoginInput.php`:

```php
<?php

namespace App\Data;

use App\Enums\SocialProvider;

final readonly class SocialLoginInput
{
    public function __construct(
        public SocialProvider $provider,
        public string $idToken,
        public ?string $nonce,
        public ?string $authorizationCode,
        public ?string $name,
        public string $timezone,
        public string $currency,
        public string $locale,
        public string $deviceName,
    ) {}
}
```

`backend/app/Http/Requests/SocialLoginRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Data\SocialLoginInput;
use App\Enums\SocialProvider;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SocialLoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $locale = $this->input('locale');

        $this->merge([
            'locale' => is_string($locale) && in_array($locale, config('subs.locales'), true) ? $locale : config('app.locale'),
        ]);
    }

    public function rules(): array
    {
        return [
            'provider' => ['required', Rule::enum(SocialProvider::class)],
            'id_token' => ['required', 'string', 'max:8192'],
            'nonce' => ['required_if:provider,apple', 'nullable', 'string', 'max:255'],
            'authorization_code' => ['nullable', 'string', 'max:2048'],
            'name' => ['nullable', 'string', 'max:255'],
            'timezone' => ['required', 'timezone:all'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'locale' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ];
    }

    public function toInput(): SocialLoginInput
    {
        $optional = fn (string $key) => $this->filled($key) ? $this->string($key)->trim()->toString() : null;

        return new SocialLoginInput(
            provider: SocialProvider::from($this->string('provider')->toString()),
            idToken: $this->string('id_token')->toString(),
            nonce: $optional('nonce'),
            authorizationCode: $optional('authorization_code'),
            name: $optional('name'),
            timezone: $this->string('timezone')->toString(),
            currency: $this->string('currency')->toString(),
            locale: $this->string('locale')->toString(),
            deviceName: $this->string('device_name')->toString(),
        );
    }
}
```

`backend/app/Services/SocialAuthService.php`:

```php
<?php

namespace App\Services;

use App\Data\IssuedToken;
use App\Data\NewSocialUser;
use App\Data\ReminderRuleInput;
use App\Data\SocialLoginInput;
use App\Data\VerifiedIdentity;
use App\Enums\SocialProvider;
use App\Models\SocialAccount;
use App\Models\User;
use App\Repositories\ReminderRuleRepository;
use App\Repositories\SocialAccountRepository;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;
use App\Services\Identity\AppleTokenVerifier;
use App\Services\Identity\GoogleTokenVerifier;
use App\Services\Identity\IdentityProviderUnavailable;
use App\Services\Identity\IdentityTokenVerifier;
use App\Services\Identity\InvalidIdentityToken;
use Illuminate\Auth\Events\Registered;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

/** Signs people in with a Google or Apple ID token: finds, links or creates their account. */
class SocialAuthService
{
    public function __construct(
        private readonly GoogleTokenVerifier $google,
        private readonly AppleTokenVerifier $apple,
        private readonly UserRepository $users,
        private readonly SocialAccountRepository $accounts,
        private readonly ReminderRuleRepository $rules,
        private readonly TransactionRunner $transactions,
    ) {}

    /**
     * @throws ValidationException on a token we cannot accept
     * @throws ServiceUnavailableHttpException when the provider's keys cannot be fetched
     */
    public function signIn(SocialLoginInput $input): IssuedToken
    {
        $identity = $this->verify($input);

        try {
            [$account, $created] = $this->findOrCreate($identity, $input);
        } catch (UniqueConstraintViolationException) {
            // A concurrent sign-in linked this identity (or created this email) first: use its result.
            [$account, $created] = $this->findOrCreate($identity, $input);
        }

        if ($created) {
            event(new Registered($account->user));
        }
        if ($identity->provider === SocialProvider::Apple) {
            $this->afterAppleSignIn($account, $input, $identity);
        }

        $user = $account->user->refresh();

        return new IssuedToken($user, $this->users->issueToken($user, $input->deviceName));
    }

    /** Task 4 exchanges Apple's authorization code here. */
    protected function afterAppleSignIn(SocialAccount $account, SocialLoginInput $input, VerifiedIdentity $identity): void {}

    private function verify(SocialLoginInput $input): VerifiedIdentity
    {
        $verifier = $this->verifierFor($input->provider);

        try {
            return $verifier->verify($input->idToken, $input->nonce);
        } catch (InvalidIdentityToken) {
            throw ValidationException::withMessages(['id_token' => __('auth.social_invalid')]);
        } catch (IdentityProviderUnavailable) {
            throw new ServiceUnavailableHttpException(null, __('auth.social_unavailable'));
        }
    }

    private function verifierFor(SocialProvider $provider): IdentityTokenVerifier
    {
        return match ($provider) {
            SocialProvider::Google => $this->google,
            SocialProvider::Apple => $this->apple,
        };
    }

    /** @return array{SocialAccount, bool} the account and whether its user was just created */
    private function findOrCreate(VerifiedIdentity $identity, SocialLoginInput $input): array
    {
        return $this->transactions->run(function () use ($identity, $input) {
            $account = $this->accounts->find($identity->provider, $identity->subject);
            if ($account) {
                $this->accounts->updateEmail($account, $identity->email);

                return [$account, false];
            }

            if ($identity->email === null || ! $identity->emailVerified) {
                throw ValidationException::withMessages(['id_token' => __('auth.social_invalid')]);
            }

            $user = $this->users->findByEmail($identity->email);
            if ($user) {
                if (! $user->hasVerifiedEmail()) {
                    $this->users->markEmailVerified($user);
                }

                return [$this->accounts->link($user, $identity), false];
            }

            $user = $this->createUser($identity->email, $input);

            return [$this->accounts->link($user, $identity), true];
        });
    }

    private function createUser(string $email, SocialLoginInput $input): User
    {
        $user = $this->users->createVerified(new NewSocialUser(
            name: $input->name ?? mb_substr(strstr($email, '@', true) ?: $email, 0, 255),
            email: $email,
            timezone: $input->timezone,
            currency: $input->currency,
            locale: $input->locale,
        ));
        $default = config('subs.default_reminder');
        $this->rules->save($user, null, new ReminderRuleInput(
            $default['days_before'], $default['time_of_day'], $default['channels'],
        ), null);

        return $user;
    }
}
```

`SocialAuthService` is not `final` only so Task 4 can keep its hook small; if the project prefers `final`, Task 4 may instead inject `AppleTokenClient` directly — either is fine as long as behaviour matches.

In `backend/app/Http/Controllers/Api/V1/AuthController.php`: add `use App\Http\Requests\SocialLoginRequest;` and `use App\Services\SocialAuthService;`, then:

```php
    public function social(SocialLoginRequest $request, SocialAuthService $social): JsonResponse
    {
        return $this->tokenResponse($social->signIn($request->toInput()));
    }
```

In `backend/routes/api.php`, inside the `throttle:auth` group after `auth/login`:

```php
        Route::post('auth/social', [AuthController::class, 'social']);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `docker compose exec php php artisan test --compact --filter='SocialAuthTest|AuthTest|LayersTest|TranslationsTest'`
Expected: PASS. If `TranslationsTest` checks that every `lang/en` key exists in other locales, there are none besides `en` today.

- [ ] **Step 5: Commit**

```bash
docker compose exec php vendor/bin/pint --dirty
git add backend && git commit -m "feat(api): sign in or sign up with a Google or Apple ID token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Apple refresh tokens and revocation on deletion

**Files:**
- Create: `backend/app/Services/Identity/AppleTokenClient.php`, `backend/app/Jobs/RevokeAppleTokens.php`
- Modify: `backend/app/Services/SocialAuthService.php`, `backend/app/Services/AccountService.php`
- Test: `backend/tests/Feature/Api/AppleTokensTest.php`

**Interfaces:**
- Consumes: `AppleToken`, `SocialAccountRepository::storeAppleToken/appleTokensFor` (Task 1); `SocialAuthService::afterAppleSignIn` hook (Task 3); config `services.apple.*` (Task 2).
- Produces:
  - `AppleTokenClient::configured(): bool`
  - `AppleTokenClient::exchange(string $authorizationCode, string $clientId): ?string` — refresh token, or null on any failure (logged).
  - `AppleTokenClient::revoke(AppleToken $token): void` — throws on HTTP failure so the job retries.
  - `RevokeAppleTokens::__construct(array $tokens)` (`list<AppleToken>`), `ShouldQueue`, `ShouldBeEncrypted`, `$tries = 3`, `backoff [60, 300]`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/Api/AppleTokensTest.php`:

```php
<?php

use App\Data\AppleToken;
use App\Jobs\RevokeAppleTokens;
use App\Models\User;
use App\Repositories\SocialAccountRepository;
use App\Services\Identity\AppleTokenClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

function configureAppleKey(): void
{
    $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    openssl_pkey_export($key, $pem);
    config(['services.apple.team_id' => 'TEAM123456', 'services.apple.key_id' => 'KEY1234567', 'services.apple.private_key' => $pem]);
}

beforeEach(function () {
    fakeIdentityProviders();
    configureAppleKey();
});

function appleSignIn(array $extra = []): \Illuminate\Testing\TestResponse
{
    return test()->postJson('/api/v1/auth/social', [
        'provider' => 'apple', 'id_token' => appleToken(), 'nonce' => TEST_NONCE, 'authorization_code' => 'code-1',
        'timezone' => 'Europe/Paris', 'currency' => 'EUR', 'locale' => 'en', 'device_name' => 'iPhone', ...$extra,
    ]);
}

it('exchanges the authorization code and stores the refresh token', function () {
    Http::fake([
        'appleid.apple.com/auth/keys' => Http::response(testJwks()),
        'appleid.apple.com/auth/token' => Http::response(['refresh_token' => 'refresh-1', 'id_token' => 'x']),
    ]);

    appleSignIn()->assertOk();

    $user = User::firstWhere('email', 'ana@example.com');
    expect(app(SocialAccountRepository::class)->appleTokensFor($user))->toEqual([new AppleToken('refresh-1', APPLE_CLIENT)]);
    Http::assertSent(fn ($r) => $r->url() === 'https://appleid.apple.com/auth/token'
        && $r['grant_type'] === 'authorization_code' && $r['code'] === 'code-1' && $r['client_id'] === APPLE_CLIENT
        && count(explode('.', $r['client_secret'])) === 3);
});

it('still signs in when the code exchange fails', function () {
    Http::fake([
        'appleid.apple.com/auth/keys' => Http::response(testJwks()),
        'appleid.apple.com/auth/token' => Http::response(['error' => 'invalid_grant'], 400),
    ]);

    appleSignIn()->assertOk();

    expect(app(SocialAccountRepository::class)->appleTokensFor(User::first()))->toBe([]);
});

it('skips the exchange when no Apple key is configured', function () {
    config(['services.apple.private_key' => null]);

    appleSignIn()->assertOk();

    Http::assertNotSent(fn ($r) => str_contains($r->url(), '/auth/token'));
});

it('queues revocation of Apple tokens when the account is deleted', function () {
    Queue::fake();
    $user = actingAsUser(['password' => null]);
    $repo = app(SocialAccountRepository::class);
    $repo->storeAppleToken($repo->link($user, new \App\Data\VerifiedIdentity(\App\Enums\SocialProvider::Apple, 'apple-sub-1', null, false, APPLE_CLIENT)),
        new AppleToken('refresh-1', APPLE_CLIENT));

    $this->deleteJson('/api/v1/me', ['confirm' => 'DELETE'])->assertNoContent();

    Queue::assertPushed(RevokeAppleTokens::class, fn (RevokeAppleTokens $job) => $job->tokens == [new AppleToken('refresh-1', APPLE_CLIENT)]);
});

it('revokes each token with Apple', function () {
    Http::fake(['appleid.apple.com/auth/revoke' => Http::response()]);

    (new RevokeAppleTokens([new AppleToken('refresh-1', APPLE_CLIENT)]))->handle(app(AppleTokenClient::class));

    Http::assertSent(fn ($r) => $r->url() === 'https://appleid.apple.com/auth/revoke'
        && $r['token'] === 'refresh-1' && $r['token_type_hint'] === 'refresh_token' && $r['client_id'] === APPLE_CLIENT);
});
```

(The deletion test needs Task 5's `confirm=DELETE`. Until Task 5 lands, it fails on validation — run Task 5 next, or temporarily give the user a password and send it. Recommended: implement Task 4 and Task 5 back to back and run both test files at the end of Task 5.)

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php php artisan test --compact --filter=AppleTokensTest`
Expected: FAIL (`Class "App\Services\Identity\AppleTokenClient" not found`).

- [ ] **Step 3: Implement**

`backend/app/Services/Identity/AppleTokenClient.php`:

```php
<?php

namespace App\Services\Identity;

use App\Data\AppleToken;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Apple's token endpoints, authenticated with a short-lived client secret signed by our .p8 key. */
final class AppleTokenClient
{
    private const BASE = 'https://appleid.apple.com/auth';

    public function configured(): bool
    {
        return filled(config('services.apple.team_id')) && filled(config('services.apple.key_id')) && filled(config('services.apple.private_key'));
    }

    /** @return string|null the refresh token; null when unconfigured or Apple refuses (logged) */
    public function exchange(string $authorizationCode, string $clientId): ?string
    {
        if (! $this->configured()) {
            Log::info('Apple key not configured; skipping the authorization code exchange.');

            return null;
        }

        try {
            $response = Http::asForm()->acceptJson()->timeout(10)->post(self::BASE.'/token', [
                'client_id' => $clientId,
                'client_secret' => $this->clientSecret($clientId),
                'code' => $authorizationCode,
                'grant_type' => 'authorization_code',
            ]);
        } catch (Throwable $e) {
            Log::warning('Apple code exchange failed.', ['error' => $e->getMessage()]);

            return null;
        }

        $token = $response->json('refresh_token');
        if (! $response->successful() || ! is_string($token)) {
            Log::warning('Apple code exchange refused.', ['status' => $response->status(), 'error' => $response->json('error')]);

            return null;
        }

        return $token;
    }

    /** @throws \Illuminate\Http\Client\RequestException so a queued caller retries */
    public function revoke(AppleToken $token): void
    {
        if (! $this->configured()) {
            Log::info('Apple key not configured; skipping token revocation.');

            return;
        }

        Http::asForm()->timeout(10)->post(self::BASE.'/revoke', [
            'client_id' => $token->clientId,
            'client_secret' => $this->clientSecret($token->clientId),
            'token' => $token->refreshToken,
            'token_type_hint' => 'refresh_token',
        ])->throw();
    }

    private function clientSecret(string $clientId): string
    {
        $key = (string) config('services.apple.private_key');
        if (! str_contains($key, 'BEGIN') && is_file($key)) {
            $key = (string) file_get_contents($key);
        }

        return JWT::encode([
            'iss' => config('services.apple.team_id'),
            'iat' => time(),
            'exp' => time() + 300,
            'aud' => 'https://appleid.apple.com',
            'sub' => $clientId,
        ], $key, 'ES256', (string) config('services.apple.key_id'));
    }
}
```

`backend/app/Jobs/RevokeAppleTokens.php`:

```php
<?php

namespace App\Jobs;

use App\Data\AppleToken;
use App\Services\Identity\AppleTokenClient;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Apple requires apps to revoke its tokens when an account is deleted. */
final class RevokeAppleTokens implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @param list<AppleToken> $tokens */
    public function __construct(public array $tokens) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(AppleTokenClient $apple): void
    {
        foreach ($this->tokens as $token) {
            $apple->revoke($token);
        }
    }
}
```

In `backend/app/Services/SocialAuthService.php`: add `private readonly AppleTokenClient $appleTokens,` to the constructor (with `use App\Services\Identity\AppleTokenClient;` and `use App\Data\AppleToken;`) and fill the hook:

```php
    /** Keeps Apple's refresh token so deleting the account can revoke it, as Apple requires. */
    protected function afterAppleSignIn(SocialAccount $account, SocialLoginInput $input, VerifiedIdentity $identity): void
    {
        if ($input->authorizationCode === null) {
            return;
        }
        $refresh = $this->appleTokens->exchange($input->authorizationCode, $identity->audience);
        if ($refresh !== null) {
            $this->accounts->storeAppleToken($account, new AppleToken($refresh, $identity->audience));
        }
    }
```

(If `SocialAuthService` was made `final`, drop `protected` → `private`; nothing overrides it.)

In `backend/app/Services/AccountService.php`: inject `private readonly SocialAccountRepository $socialAccounts,` and change `delete`:

```php
    public function delete(User $user): void
    {
        $logos = $this->services->logoPathsOwnedBy($user);
        $appleTokens = $this->socialAccounts->appleTokensFor($user);

        $this->transactions->run(fn () => $this->users->delete($user));

        // Files and Apple tokens only once the rows are really gone.
        $this->logos->delete($logos);
        if ($appleTokens !== []) {
            RevokeAppleTokens::dispatch($appleTokens);
        }
    }
```

(imports: `use App\Jobs\RevokeAppleTokens;`, `use App\Repositories\SocialAccountRepository;`)

- [ ] **Step 4: Run the tests (all but the deletion one pass now)**

Run: `docker compose exec php php artisan test --compact --filter='AppleTokensTest|SocialAuthTest|LayersTest'`
Expected: PASS except `queues revocation of Apple tokens when the account is deleted` (422 until Task 5).

- [ ] **Step 5: Commit**

```bash
docker compose exec php vendor/bin/pint --dirty
git add backend && git commit -m "feat(api): keep Apple refresh tokens and revoke them when an account is deleted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Accounts without a password: `has_password` and delete with `DELETE`

**Files:**
- Modify: `backend/app/Http/Requests/DeleteAccountRequest.php`, `backend/app/Http/Resources/UserResource.php`
- Test: `backend/tests/Feature/Api/MeTest.php`

**Interfaces:**
- Produces: `/me` and every `user` payload include `has_password: bool`; `DELETE /me` takes `{password}` when the user has one, else `{confirm: "DELETE"}`.

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/Feature/Api/MeTest.php`)

```php
it('says whether the account has a password', function () {
    actingAsUser(['password' => 'secret-pass-1']);
    $this->getJson('/api/v1/me')->assertJsonPath('data.has_password', true);

    actingAsUser(['password' => null]);
    $this->getJson('/api/v1/me')->assertJsonPath('data.has_password', false);
});

it('deletes an account without a password when confirmed with DELETE', function () {
    actingAsUser(['password' => null]);

    $this->deleteJson('/api/v1/me', ['confirm' => 'nope'])->assertUnprocessable()->assertJsonValidationErrors('confirm');
    $this->deleteJson('/api/v1/me', ['confirm' => 'DELETE'])->assertNoContent();
});

it('still requires the password for an account that has one', function () {
    actingAsUser(['password' => 'secret-pass-1']);

    $this->deleteJson('/api/v1/me', ['confirm' => 'DELETE'])->assertUnprocessable()->assertJsonValidationErrors('password');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php php artisan test --compact --filter=MeTest`
Expected: FAIL (`has_password` missing; `confirm` ignored).

- [ ] **Step 3: Implement**

`backend/app/Http/Requests/DeleteAccountRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Account deletion is confirmed with the current password, or by typing DELETE when there is none. */
class DeleteAccountRequest extends FormRequest
{
    public function rules(): array
    {
        return $this->user()->password === null
            ? ['confirm' => ['required', 'string', 'in:DELETE']]
            : ['password' => ['required', 'current_password:sanctum']];
    }
}
```

In `backend/app/Http/Resources/UserResource.php`, add after `'email_verified'`:

```php
            'has_password' => $this->password !== null,
```

- [ ] **Step 4: Run the backend suite**

Run: `docker compose exec php php artisan test --compact`
Expected: all PASS, including `AppleTokensTest`'s deletion test.

- [ ] **Step 5: Commit**

```bash
docker compose exec php vendor/bin/pint --dirty
git add backend && git commit -m "feat(api): let accounts without a password delete themselves by typing DELETE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App plumbing: packages, mocks, API and `useSocialLogin`

**Files:**
- Create: `app/src/auth/social/types.ts`, `config.ts`, `nonce.ts`, `useSocialLogin.ts`, `useSocialLogin.test.tsx`, `nonce.test.ts`
- Modify: `app/package.json` (via `expo install`), `app/jest.setup.ts`, `app/src/api/auth.ts`, `app/src/api/types.ts`, `app/src/test/fixtures.ts`, `app/.env.example`

**Interfaces:**
- Consumes: `POST /auth/social` (Task 3), `has_password` (Task 5).
- Produces:
  - `type SocialProvider = 'google' | 'apple'`
  - `type SocialCredential = { provider: SocialProvider; idToken: string; nonce?: string; authorizationCode?: string; name?: string }`
  - `type SocialOutcome = { type: 'credential'; credential: SocialCredential } | { type: 'cancelled' }`
  - `socialConfig: { googleWebClientId?: string; googleIosClientId?: string; appleServicesId?: string; appleRedirectUri?: string }`, `inExpoGo(): boolean`
  - `makeNonce(): Promise<{ raw: string; hashed: string }>`
  - `authApi.social(body: SocialBody): Promise<AuthResponse>`
  - `useSocialLogin(): { signIn: (credential: SocialCredential) => Promise<void>; busy: SocialProvider | null; error: unknown; start: (provider: SocialProvider) => void; fail: (error: unknown) => void; reset: () => void }`
  - `User.has_password: boolean`

- [ ] **Step 1: Install the packages**

```bash
cd app
npx expo install @react-native-google-signin/google-signin expo-apple-authentication expo-crypto
git checkout -- tsconfig.json
```

Read the three docs pages named in Global Constraints for the installed versions before writing Task 7.

- [ ] **Step 2: Add mocks to `app/jest.setup.ts`** (append)

```ts
jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(7)),
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `sha256(${value})`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
  },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS' },
}));
```

- [ ] **Step 3: Write the failing tests**

`app/src/auth/social/nonce.test.ts`:

```ts
import { makeNonce } from './nonce';

test('returns a raw nonce and its SHA-256', async () => {
  const { raw, hashed } = await makeNonce();

  expect(raw).toMatch(/^[0-9a-f]{64}$/);
  expect(hashed).toBe(`sha256(${raw})`);
});
```

`app/src/auth/social/useSocialLogin.test.tsx`:

```tsx
import { act, waitFor } from '@testing-library/react-native';

import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, mockApi, renderHookWithProviders } from '@/test/utils';

import { useSocialLogin } from './useSocialLogin';

beforeEach(() => useSession.setState({ status: 'signedOut', token: null }));

test('posts the credential with the device settings, then signs in', async () => {
  const user = fixtures.user();
  const calls = mockApi({ 'POST /auth/social': { body: { token: 'tok', user } } });
  const client = createTestQueryClient();
  const { result } = await renderHookWithProviders(() => useSocialLogin(), client);

  await act(() => result.current.signIn({ provider: 'apple', idToken: 'id', nonce: 'raw', authorizationCode: 'code', name: 'Ana' }));

  expect(calls[0].body).toMatchObject({
    provider: 'apple', id_token: 'id', nonce: 'raw', authorization_code: 'code', name: 'Ana',
    timezone: 'Europe/Berlin', currency: 'USD', locale: 'en',
  });
  expect(typeof (calls[0].body as { device_name: string }).device_name).toBe('string');
  await waitFor(() => expect(useSession.getState()).toMatchObject({ status: 'signedIn', token: 'tok' }));
  expect(client.getQueryData(keys.me)).toEqual(user);
  expect(result.current.busy).toBeNull();
});

test('keeps the API error for the screen and clears busy', async () => {
  mockApi({ 'POST /auth/social': { status: 422, body: { message: 'Nope', errors: { id_token: ["We couldn't verify your sign-in. Please try again."] } } } });
  const { result } = await renderHookWithProviders(() => useSocialLogin());

  await act(() => result.current.signIn({ provider: 'google', idToken: 'id' }));

  expect(result.current.error).toBeTruthy();
  expect(result.current.busy).toBeNull();
  expect(useSession.getState().status).toBe('signedOut');
});
```

If `renderHookWithProviders` in `src/test/utils.tsx` has a different signature, use it as it is (read the file) — only the call shape may change, not the assertions.

- [ ] **Step 4: Run them to verify they fail**

Run: `npx jest src/auth/social`
Expected: FAIL (`Cannot find module './nonce'`).

- [ ] **Step 5: Implement**

`app/src/auth/social/types.ts`:

```ts
export type SocialProvider = 'google' | 'apple';

/** What a provider sheet hands back; the API verifies it. Apple adds the raw nonce, its code and, once, the name. */
export type SocialCredential = {
  provider: SocialProvider;
  idToken: string;
  nonce?: string;
  authorizationCode?: string;
  name?: string;
};

export type SocialOutcome = { type: 'credential'; credential: SocialCredential } | { type: 'cancelled' };
```

`app/src/auth/social/config.ts`:

```ts
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Public OAuth client IDs; none are secrets. Unset ones hide their button. */
export const socialConfig = {
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  appleServicesId: process.env.EXPO_PUBLIC_APPLE_SERVICES_ID || undefined,
  appleRedirectUri: process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI || undefined,
};

/** Expo Go lacks the Google SDK, and Apple there signs tokens for Expo Go's bundle ID, not ours. */
export function inExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
```

(If the jest `expo-constants` mock lacks `ExecutionEnvironment`, extend that mock in `jest.setup.ts` with `ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare', Standalone: 'standalone' }` and `executionEnvironment: 'bare'` on the default export.)

`app/src/auth/social/nonce.ts`:

```ts
import * as Crypto from 'expo-crypto';

/** Apple gets the SHA-256; the API gets the raw value and checks it matches the token. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw, { encoding: Crypto.CryptoEncoding.HEX });
  return { raw, hashed };
}
```

In `app/src/api/types.ts`, add `has_password: boolean;` to `User` after `email_verified`. In `app/src/test/fixtures.ts`, add `has_password: true,` to `user()` after `email_verified`.

In `app/src/api/auth.ts`, add:

```ts
export type SocialBody = {
  provider: 'google' | 'apple';
  id_token: string;
  nonce?: string;
  authorization_code?: string;
  name?: string;
  timezone: string;
  currency: string;
  locale: string;
  device_name: string;
};
```

and in `authApi`:

```ts
  social: (body: SocialBody) => api<AuthResponse>('/auth/social', { method: 'POST', body }),
```

`app/src/auth/social/useSocialLogin.ts`:

```ts
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { authApi } from '@/api/auth';
import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { deviceLocale } from '@/i18n';
import { defaultCurrency } from '@/lib/currencies';
import { deviceTimeZone } from '@/lib/dates';
import { deviceName } from '@/lib/device';

import type { SocialCredential, SocialProvider } from './types';

/** Trades a provider credential for a Subs session, exactly as email login does afterwards. */
export function useSocialLogin() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<unknown>(null);

  const start = (provider: SocialProvider) => {
    setError(null);
    setBusy(provider);
  };
  const reset = () => setBusy(null);
  const fail = (failure: unknown) => {
    setBusy(null);
    setError(failure);
  };

  const signIn = async (credential: SocialCredential) => {
    start(credential.provider);
    try {
      const { token, user } = await authApi.social({
        provider: credential.provider,
        id_token: credential.idToken,
        nonce: credential.nonce,
        authorization_code: credential.authorizationCode,
        name: credential.name,
        timezone: deviceTimeZone(),
        currency: defaultCurrency(),
        locale: deviceLocale(),
        device_name: deviceName(),
      });
      qc.setQueryData(keys.me, user);
      await useSession.getState().signIn(token);
      setBusy(null);
    } catch (failure) {
      fail(failure);
    }
  };

  return { signIn, busy, error, start, fail, reset };
}
```

Append to `app/.env.example`:

```
# Sign in with Google / Apple (public IDs; see README). Leave empty to hide a button.
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_APPLE_SERVICES_ID=
EXPO_PUBLIC_APPLE_REDIRECT_URI=
```

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `npx jest src/auth/social && npx tsc --noEmit && npx expo lint`
Expected: PASS / no errors. (`has_password` added to `User` may require updating object literals typed as `User` elsewhere in tests; add `has_password: true` there.)

- [ ] **Step 7: Commit**

```bash
git checkout -- tsconfig.json
git add app && git commit -m "feat(app): social sign-in plumbing: packages, nonce, API call and hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Native buttons (iOS and Android) on Login and Register

**Files:**
- Create: `app/src/auth/social/google.ts`, `app/src/auth/social/apple.ts`, `app/src/components/SocialButtons.tsx`, `app/src/components/SocialButtons.test.tsx`
- Modify: `app/src/screens/auth/LoginScreen.tsx`, `app/src/screens/auth/RegisterScreen.tsx`, `app/src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `useSocialLogin`, `socialConfig`, `inExpoGo`, `makeNonce`, types (Task 6).
- Produces:
  - `googleAvailable(): boolean`, `signInWithGoogle(): Promise<SocialOutcome>`
  - `appleAvailable(): Promise<boolean>`, `signInWithApple(): Promise<SocialOutcome>`
  - `<SocialButtons />` — no props; renders nothing when no provider is available, otherwise the buttons, an "or" divider below them and an inline error.
  - i18n keys `auth.continueWithGoogle`, `auth.continueWithApple`, `auth.or`.

- [ ] **Step 1: Write the failing tests**

`app/src/components/SocialButtons.test.tsx`:

```tsx
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useSession } from '@/auth/session';
import { socialConfig } from '@/auth/social/config';
import { fixtures } from '@/test/fixtures';
import { mockApi, renderWithProviders } from '@/test/utils';

import { SocialButtons } from './SocialButtons';

const google = GoogleSignin.signIn as jest.Mock;
const apple = AppleAuthentication.signInAsync as jest.Mock;

beforeEach(() => {
  useSession.setState({ status: 'signedOut', token: null });
  socialConfig.googleWebClientId = 'web-client';
  socialConfig.googleIosClientId = 'ios-client';
  Platform.OS = 'ios';
  (Constants as { executionEnvironment?: string }).executionEnvironment = 'bare';
});

test('shows Apple and Google on iOS', async () => {
  await renderWithProviders(<SocialButtons />);

  expect(await screen.findByLabelText('Continue with Apple')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  expect(screen.getByText('or')).toBeTruthy();
});

test('shows only Google on Android', async () => {
  Platform.OS = 'android';
  await renderWithProviders(<SocialButtons />);

  expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  expect(screen.queryByLabelText('Continue with Apple')).toBeNull();
});

test('hides Google without a client ID and everything in Expo Go', async () => {
  socialConfig.googleWebClientId = undefined;
  const { unmount } = await renderWithProviders(<SocialButtons />);
  expect(await screen.findByLabelText('Continue with Apple')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
  unmount();

  (Constants as { executionEnvironment?: string }).executionEnvironment = 'storeClient';
  await renderWithProviders(<SocialButtons />);
  expect(screen.queryByText('or')).toBeNull();
});

test('signs in with Google', async () => {
  google.mockResolvedValueOnce({ type: 'success', data: { idToken: 'g-token' } });
  const calls = mockApi({ 'POST /auth/social': { body: { token: 'tok', user: fixtures.user() } } });
  await renderWithProviders(<SocialButtons />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));

  await waitFor(() => expect(useSession.getState().token).toBe('tok'));
  expect(calls[0].body).toMatchObject({ provider: 'google', id_token: 'g-token' });
});

test('sends Apple the hashed nonce and the API the raw one', async () => {
  apple.mockResolvedValueOnce({ identityToken: 'a-token', authorizationCode: 'code', fullName: { givenName: 'Ana', familyName: 'María' } });
  const calls = mockApi({ 'POST /auth/social': { body: { token: 'tok', user: fixtures.user() } } });
  await renderWithProviders(<SocialButtons />);

  await fireEvent.press(await screen.findByLabelText('Continue with Apple'));

  await waitFor(() => expect(calls).toHaveLength(1));
  const sent = calls[0].body as { nonce: string };
  expect(apple).toHaveBeenCalledWith(expect.objectContaining({ nonce: `sha256(${sent.nonce})` }));
  expect(calls[0].body).toMatchObject({ provider: 'apple', id_token: 'a-token', authorization_code: 'code', name: 'Ana María' });
});

test('does nothing when the person cancels', async () => {
  google.mockResolvedValueOnce({ type: 'cancelled', data: null });
  const calls = mockApi({});
  await renderWithProviders(<SocialButtons />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));

  await waitFor(() => expect(google).toHaveBeenCalled());
  expect(calls).toHaveLength(0);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('shows the API error', async () => {
  google.mockResolvedValueOnce({ type: 'success', data: { idToken: 'g-token' } });
  mockApi({ 'POST /auth/social': { status: 422, body: { message: "We couldn't verify your sign-in. Please try again.", errors: { id_token: ["We couldn't verify your sign-in. Please try again."] } } } });
  await renderWithProviders(<SocialButtons />);

  await fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));

  expect(await screen.findByText("We couldn't verify your sign-in. Please try again.")).toBeTruthy();
});
```

The Apple button is rendered with `accessibilityLabel` on a wrapping `Pressable`-free element: `AppleAuthenticationButton` is native, so the test finds it by label. In the mock it renders `null`; therefore wrap it as below (a `View` with the label and `onPress` forwarded through a test-visible `Pressable` is not allowed by Apple's rules). Instead the component renders `AppleAuthenticationButton` inside `<View accessibilityLabel={label} accessible>`; to press it in tests, change the mock in `jest.setup.ts` to render a pressable stand-in:

```ts
  AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable } = require('react-native');
    return require('react').createElement(Pressable, { onPress, testID: 'apple-button' });
  },
```

and in the tests press it with `fireEvent.press(await screen.findByTestId('apple-button'))` in place of `findByLabelText('Continue with Apple')` where a press is needed (presence checks keep using the label).

`ErrorMessage` must render with `accessibilityRole="alert"` for the cancel test's `queryByRole('alert')`; if it does not, assert `screen.queryByText(/couldn't/)` is null instead.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest src/components/SocialButtons.test.tsx`
Expected: FAIL (`Cannot find module './SocialButtons'`).

- [ ] **Step 3: Implement**

`app/src/auth/social/google.ts`:

```ts
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { inExpoGo, socialConfig } from './config';
import type { SocialOutcome } from './types';

let configured = false;

export function googleAvailable(): boolean {
  return !inExpoGo() && socialConfig.googleWebClientId !== undefined;
}

/** The native Google sheet. `webClientId` makes Android tokens carry our web client as audience. */
export async function signInWithGoogle(): Promise<SocialOutcome> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: socialConfig.googleWebClientId, iosClientId: socialConfig.googleIosClientId });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response) || !response.data.idToken) return { type: 'cancelled' };
    return { type: 'credential', credential: { provider: 'google', idToken: response.data.idToken } };
  } catch (error) {
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) {
      return { type: 'cancelled' };
    }
    throw error;
  }
}
```

`app/src/auth/social/apple.ts`:

```ts
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { inExpoGo } from './config';
import { makeNonce } from './nonce';
import type { SocialOutcome } from './types';

const CANCELED = 'ERR_REQUEST_CANCELED';

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || inExpoGo()) return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function signInWithApple(): Promise<SocialOutcome> {
  const { raw, hashed } = await makeNonce();
  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!result.identityToken) return { type: 'cancelled' };
    const name = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    return {
      type: 'credential',
      credential: { provider: 'apple', idToken: result.identityToken, nonce: raw, authorizationCode: result.authorizationCode ?? undefined, name },
    };
  } catch (error) {
    if ((error as { code?: string }).code === CANCELED) return { type: 'cancelled' };
    throw error;
  }
}
```

Add to `app/src/i18n/locales/en.json` inside `"auth"`:

```json
    "continueWithGoogle": "Continue with Google",
    "continueWithApple": "Continue with Apple",
    "or": "or",
```

`app/src/components/SocialButtons.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { appleAvailable, signInWithApple } from '@/auth/social/apple';
import { googleAvailable, signInWithGoogle } from '@/auth/social/google';
import type { SocialOutcome, SocialProvider } from '@/auth/social/types';
import { useSocialLogin } from '@/auth/social/useSocialLogin';
import { useScheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { ErrorMessage } from './ErrorMessage';

const GOOGLE_ICON = 'logo-google';
const BUTTON_HEIGHT = 52;

/** "Continue with Apple / Google" over an "or" divider; renders nothing when neither can work here. */
export function SocialButtons() {
  const { t } = useTranslation();
  const dark = useScheme() === 'dark';
  const login = useSocialLogin();
  const [apple, setApple] = useState(false);
  const google = googleAvailable();

  useEffect(() => {
    let active = true;
    void appleAvailable().then((ok) => active && setApple(ok));
    return () => {
      active = false;
    };
  }, []);

  if (!apple && !google) return null;

  const run = async (provider: SocialProvider, open: () => Promise<SocialOutcome>) => {
    login.start(provider);
    try {
      const outcome = await open();
      if (outcome.type === 'cancelled') login.reset();
      else await login.signIn(outcome.credential);
    } catch (error) {
      login.fail(error);
    }
  };

  return (
    <View className="gap-3">
      {apple ? (
        <View accessible accessibilityLabel={t('auth.continueWithApple')} style={{ height: BUTTON_HEIGHT }}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={{ height: BUTTON_HEIGHT, width: '100%' }}
            onPress={() => void run('apple', signInWithApple)}
          />
        </View>
      ) : null}
      {google ? (
        <Button
          label={t('auth.continueWithGoogle')}
          variant="secondary"
          className="h-[52px]"
          loading={login.busy === 'google'}
          icon={<Ionicons name={GOOGLE_ICON} size={18} color={dark ? '#F1F3F5' : '#14171C'} />}
          onPress={() => void run('google', signInWithGoogle)}
        />
      ) : null}
      <ErrorMessage error={login.error} />
      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-line dark:bg-line-dark" />
        <AppText variant="muted" className="text-sm">{t('auth.or')}</AppText>
        <View className="h-px flex-1 bg-line dark:bg-line-dark" />
      </View>
    </View>
  );
}
```

If `Button` has no `icon` prop, add an optional `icon?: ReactNode` rendered before the label inside `Button` (keep its existing behaviour unchanged) — or drop the icon; the label alone satisfies the tests.

In `app/src/screens/auth/LoginScreen.tsx` add `import { SocialButtons } from '@/components/SocialButtons';` and render `<SocialButtons />` as the first child of the form `View` (`<View className="gap-4 px-2 pt-4">`), above the email field. Do the same in `app/src/screens/auth/RegisterScreen.tsx`, above its first form field.

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `npx jest src/components/SocialButtons.test.tsx src/screens/auth && npx tsc --noEmit && npx expo lint`
Expected: PASS. Existing Login/Register tests keep passing because in Jest Platform defaults to iOS with a client ID unset unless a test sets it — if they start failing on an extra button, set `socialConfig.googleWebClientId = undefined` and mock `appleAvailable` to false in those files' `beforeEach`.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): Continue with Apple and Google on the login and sign-up screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Web buttons (Google Identity Services, Sign in with Apple JS)

**Files:**
- Create: `app/src/auth/social/google.web.ts`, `app/src/auth/social/apple.web.ts`, `app/src/auth/social/loadScript.web.ts`, `app/src/components/SocialButtons.web.tsx`

**Interfaces:**
- Consumes: Task 6 types/hook/config/nonce; i18n keys from Task 7.
- Produces (web builds only): `googleAvailable(): boolean`, `renderGoogleButton(el: HTMLElement, opts: { dark: boolean; width: number; onCredential: (c: SocialCredential) => void; onError: (e: unknown) => void }): Promise<void>`; `appleAvailable(): Promise<boolean>`, `signInWithApple(): Promise<SocialOutcome>`; `<SocialButtons />` with the same contract as native.

These files only run in the browser, so they are verified by hand (Step 3), not Jest.

- [ ] **Step 1: Implement**

`app/src/auth/social/loadScript.web.ts`:

```ts
const loading = new Map<string, Promise<void>>();

/** Adds a third-party script once and resolves when it has loaded. */
export function loadScript(src: string): Promise<void> {
  let promise = loading.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loading.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
    loading.set(src, promise);
  }
  return promise;
}
```

`app/src/auth/social/google.web.ts`:

```ts
import { socialConfig } from './config';
import { loadScript } from './loadScript.web';
import type { SocialCredential } from './types';

const GIS = 'https://accounts.google.com/gsi/client';

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode: 'popup' }) => void;
  renderButton: (el: HTMLElement, o: Record<string, string | number>) => void;
};

export function googleAvailable(): boolean {
  return socialConfig.googleWebClientId !== undefined;
}

/** Google only lets the web sign in through its own rendered button. */
export async function renderGoogleButton(
  el: HTMLElement,
  { dark, width, onCredential, onError }: { dark: boolean; width: number; onCredential: (c: SocialCredential) => void; onError: (e: unknown) => void },
): Promise<void> {
  try {
    await loadScript(GIS);
    const id = (window as unknown as { google: { accounts: { id: GoogleId } } }).google.accounts.id;
    id.initialize({
      client_id: socialConfig.googleWebClientId as string,
      ux_mode: 'popup',
      callback: ({ credential }) => {
        if (credential) onCredential({ provider: 'google', idToken: credential });
      },
    });
    el.innerHTML = '';
    id.renderButton(el, { type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width });
  } catch (error) {
    onError(error);
  }
}
```

`app/src/auth/social/apple.web.ts`:

```ts
import { socialConfig } from './config';
import { loadScript } from './loadScript.web';
import { makeNonce } from './nonce';
import type { SocialOutcome } from './types';

const APPLE_JS = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const CANCELLED = 'popup_closed_by_user';

type AppleId = {
  auth: {
    init: (o: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; nonce: string }) => void;
    signIn: () => Promise<{ authorization: { id_token: string; code?: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
  };
};

export async function appleAvailable(): Promise<boolean> {
  return socialConfig.appleServicesId !== undefined && socialConfig.appleRedirectUri !== undefined;
}

export async function signInWithApple(): Promise<SocialOutcome> {
  await loadScript(APPLE_JS);
  const { raw, hashed } = await makeNonce();
  const AppleID = (window as unknown as { AppleID: AppleId }).AppleID;
  AppleID.auth.init({
    clientId: socialConfig.appleServicesId as string,
    scope: 'name email',
    redirectURI: socialConfig.appleRedirectUri as string,
    usePopup: true,
    nonce: hashed,
  });
  try {
    const { authorization, user } = await AppleID.auth.signIn();
    const name = [user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(' ') || undefined;
    return { type: 'credential', credential: { provider: 'apple', idToken: authorization.id_token, nonce: raw, authorizationCode: authorization.code, name } };
  } catch (error) {
    if ((error as { error?: string }).error === CANCELLED) return { type: 'cancelled' };
    throw error;
  }
}
```

`expo-crypto` works on web (it uses Web Crypto); if `makeNonce` fails in the browser, switch `nonce.ts` to `crypto.getRandomValues` + `crypto.subtle.digest` in a `nonce.web.ts`.

`app/src/components/SocialButtons.web.tsx`:

```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { appleAvailable, signInWithApple } from '@/auth/social/apple.web';
import { googleAvailable, renderGoogleButton } from '@/auth/social/google.web';
import { useSocialLogin } from '@/auth/social/useSocialLogin';
import { useScheme } from '@/theme';

import { AppText } from './AppText';
import { ErrorMessage } from './ErrorMessage';

const APPLE_ICON = 'logo-apple';
const GOOGLE_WIDTH = 320;

export function SocialButtons() {
  const { t } = useTranslation();
  const dark = useScheme() === 'dark';
  const login = useSocialLogin();
  const googleRef = useRef<View>(null);
  const [apple, setApple] = useState(false);
  const google = googleAvailable();

  useEffect(() => {
    void appleAvailable().then(setApple);
  }, []);

  useEffect(() => {
    const el = googleRef.current as unknown as HTMLElement | null;
    if (google && el) {
      void renderGoogleButton(el, { dark, width: GOOGLE_WIDTH, onCredential: (c) => void login.signIn(c), onError: login.fail });
    }
    // Re-render Google's widget when the theme changes; the login callbacks are stable enough for a click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, dark]);

  if (!apple && !google) return null;

  const appleSignIn = async () => {
    login.start('apple');
    try {
      const outcome = await signInWithApple();
      if (outcome.type === 'cancelled') login.reset();
      else await login.signIn(outcome.credential);
    } catch (error) {
      login.fail(error);
    }
  };

  return (
    <View className="gap-3">
      {apple ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithApple')}
          onPress={() => void appleSignIn()}
          className="h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-black dark:bg-white">
          <Ionicons name={APPLE_ICON} size={20} color={dark ? '#000000' : '#FFFFFF'} />
          <Text className="font-semibold text-base text-white dark:text-black">{t('auth.continueWithApple')}</Text>
        </Pressable>
      ) : null}
      {google ? <View ref={googleRef} className="items-center" /> : null}
      <ErrorMessage error={login.error} />
      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-line dark:bg-line-dark" />
        <AppText variant="muted" className="text-sm">{t('auth.or')}</AppText>
        <View className="h-px flex-1 bg-line dark:bg-line-dark" />
      </View>
    </View>
  );
}
```

If the lint rule `react-hooks/exhaustive-deps` is not configured, drop the disable comment. If the React Compiler lint flags the ref read in the effect, keep the read inside the effect (it is) and use `useEffectEvent` for `login.signIn`/`login.fail`, as `DateTimeModal.tsx` does.

- [ ] **Step 2: Typecheck, lint and run the whole app suite**

Run: `npx tsc --noEmit && npx expo lint && npx jest`
Expected: no errors; all tests PASS (Jest resolves the native files, not `.web` ones).

- [ ] **Step 3: Check it in the browser**

With `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set in `app/.env` (the user creates it; skip this step and say so if it is not set yet) and the backend's `GOOGLE_CLIENT_IDS` containing it, restart `npx expo start --web --clear`, open `http://localhost:8081/login`, and confirm: Google's button renders above the form, its popup opens, choosing an account lands on Home or onboarding, and a second sign-in reaches the same account. Apple needs an HTTPS domain and is checked later.

- [ ] **Step 4: Commit**

```bash
git checkout -- tsconfig.json
git add app && git commit -m "feat(app): Google and Apple sign-in buttons on web

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Settings: delete an account without a password

**Files:**
- Modify: `app/src/api/me.ts`, `app/src/screens/SettingsScreen.tsx`, `app/src/i18n/locales/en.json`
- Test: `app/src/screens/SettingsScreen.test.tsx`

**Interfaces:**
- Consumes: `User.has_password` (Task 6), `DELETE /me` with `{confirm: 'DELETE'}` (Task 5).
- Produces: `useDeleteAccount()` mutation now takes `{ password: string } | { confirm: 'DELETE' }`.

- [ ] **Step 1: Write the failing tests** (append to `app/src/screens/SettingsScreen.test.tsx`)

```tsx
test('an account without a password confirms deletion by typing DELETE, in any case', async () => {
  const user = fixtures.user({ has_password: false });
  const { calls, client } = setup({ 'DELETE /me': { status: 204 } }, user);
  await renderWithProviders(<SettingsScreen />, client);

  expect(screen.queryByLabelText('Your password')).toBeNull();
  const confirm = await screen.findByLabelText('Type DELETE to confirm');
  const button = screen.getByRole('button', { name: 'Delete my account' });

  await fireEvent.changeText(confirm, 'nope');
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });

  await fireEvent.changeText(confirm, ' delete ');
  await fireEvent.press(button);

  await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/me')).toBe(true));
  expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ confirm: 'DELETE' });
});

test('an account with a password still deletes with it', async () => {
  const { calls, client } = setup({ 'DELETE /me': { status: 204 } });
  await renderWithProviders(<SettingsScreen />, client);

  await fireEvent.changeText(await screen.findByLabelText('Your password'), 'secret-pass-1');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));

  await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ password: 'secret-pass-1' }));
});
```

Use the real labels from `en.json`: read `settings.deletePassword` and `settings.deleteConfirm` and substitute them for `'Your password'` and `'Delete my account'` if they differ.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest src/screens/SettingsScreen.test.tsx`
Expected: FAIL (no "Type DELETE to confirm" field).

- [ ] **Step 3: Implement**

`app/src/api/me.ts`:

```ts
export type DeleteConfirmation = { password: string } | { confirm: 'DELETE' };

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirmation: DeleteConfirmation) => api<void>('/me', { method: 'DELETE', body: confirmation }),
    onSuccess: () => useSession.getState().signOut(),
  });
}
```

`app/src/i18n/locales/en.json`, inside `"settings"`:

```json
    "deleteTypeConfirm": "Type DELETE to confirm",
```

In `app/src/screens/SettingsScreen.tsx`, replace `DangerGroup` and its call site:

```tsx
const DELETE_WORD = 'DELETE';

function DangerGroup({ user }: { user: User }) {
  const { t } = useTranslation();
  const remove = useDeleteAccount();
  const [value, setValue] = useState('');
  const typed = value.trim().toUpperCase() === DELETE_WORD;

  const submit = () => remove.mutate(user.has_password ? { password: value } : { confirm: DELETE_WORD });

  return (
    <Group title={t('settings.dangerZone')}>
      <View className="gap-3 py-3">
        <AppText variant="muted">{t('settings.deleteWarning')}</AppText>
        {user.has_password ? (
          <TextField label={t('settings.deletePassword')} value={value} onChangeText={setValue} secureTextEntry autoComplete="current-password" />
        ) : (
          <TextField label={t('settings.deleteTypeConfirm')} value={value} onChangeText={setValue} autoCapitalize="characters" autoCorrect={false} />
        )}
        <Button
          label={t('settings.deleteConfirm')}
          variant="danger"
          loading={remove.isPending}
          disabled={user.has_password ? value === '' : !typed}
          onPress={submit}
        />
        <ErrorMessage error={remove.error} />
      </View>
    </Group>
  );
}
```

and render `<DangerGroup user={me.data} />` in `SettingsScreen`.

If `TextField` does not forward `autoCapitalize`/`autoCorrect`, it spreads `TextInputProps` in most setups; if not, drop those two props.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx jest src/screens/SettingsScreen.test.tsx && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app && git commit -m "feat(app): accounts without a password confirm deletion by typing DELETE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: App config from env, free-signing builds, and setup docs

**Files:**
- Create: `app/app.config.ts`, `app/app.config.test.ts`
- Modify: `README.md` (repo root)

**Interfaces:**
- Consumes: the plugins added in Tasks 6–7; `app/app.json` stays the source of static config (EAS writes to it).
- Produces: `export default function config({ config }: ConfigContext): ExpoConfig` and exported helper `googleUrlScheme(iosClientId: string): string`.

- [ ] **Step 1: Write the failing test**

`app/app.config.test.ts`:

```ts
import type { ExpoConfig } from 'expo/config';

import appConfig, { googleUrlScheme } from './app.config';

const base: ExpoConfig = { name: 'Subs', slug: 'subs', ios: { bundleIdentifier: 'com.alterwave.subs' }, plugins: ['expo-router', 'expo-notifications'] };

const pluginNames = (c: ExpoConfig) => (c.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));

afterEach(() => {
  delete process.env.FREE_SIGNING;
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
});

test('reverses the iOS client ID into Google\'s URL scheme', () => {
  expect(googleUrlScheme('123-abc.apps.googleusercontent.com')).toBe('com.googleusercontent.apps.123-abc');
});

test('adds Apple sign-in, and Google when its iOS client ID is set', () => {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123-abc.apps.googleusercontent.com';
  const c = appConfig({ config: base } as never);

  expect(c.ios?.usesAppleSignIn).toBe(true);
  expect(pluginNames(c)).toEqual(expect.arrayContaining(['expo-notifications', 'expo-apple-authentication', '@react-native-google-signin/google-signin']));
});

test('a free-signing build drops push and Apple sign-in', () => {
  process.env.FREE_SIGNING = '1';
  const c = appConfig({ config: base } as never);

  expect(c.ios?.usesAppleSignIn).toBe(false);
  expect(pluginNames(c)).not.toContain('expo-notifications');
  expect(pluginNames(c)).not.toContain('expo-apple-authentication');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest app.config.test.ts`
Expected: FAIL (`Cannot find module './app.config'`).

- [ ] **Step 3: Implement**

`app/app.config.ts`:

```ts
import type { ConfigContext, ExpoConfig } from 'expo/config';

const NOTIFICATIONS = 'expo-notifications';
const APPLE = 'expo-apple-authentication';
const GOOGLE = '@react-native-google-signin/google-signin';

/** Google's iOS URL scheme is the iOS client ID reversed. */
export function googleUrlScheme(iosClientId: string): string {
  return `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
}

/**
 * `app.json` holds the static config; this adds what depends on the environment.
 * FREE_SIGNING=1 builds without push and Sign in with Apple, which a free Apple ID cannot sign.
 */
export default function config({ config: base }: ConfigContext): ExpoConfig {
  const free = process.env.FREE_SIGNING === '1';
  const googleIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  const plugins = (base.plugins ?? []).filter((p) => !(free && (p === NOTIFICATIONS || (Array.isArray(p) && p[0] === NOTIFICATIONS))));
  if (!free) plugins.push(APPLE);
  if (googleIos) plugins.push([GOOGLE, { iosUrlScheme: googleUrlScheme(googleIos) }]);

  return {
    ...base,
    name: base.name ?? 'Subs',
    slug: base.slug ?? 'subs',
    ios: { ...base.ios, usesAppleSignIn: !free },
    plugins,
  };
}
```

Check: `npx expo config --type public` in `app/` prints the merged config with the new plugins (then `git checkout -- tsconfig.json`).

Add a README section after "## App (Expo)" in the repo-root `README.md`:

````markdown
## Sign in with Google and Apple

The app shows a provider's button only when its IDs are configured; neither shows in Expo Go.

**Google Cloud console** (APIs & Services → Credentials):
1. Configure the OAuth consent screen (External, app name "Subs").
2. Create OAuth client IDs:
   - **Web application** — authorised JavaScript origins `http://localhost:8081` and your production URL.
   - **iOS** — bundle ID `com.alterwave.subs`.
   - **Android** — package `com.alterwave.subs` and the SHA-1 of the signing key (`npx expo run:android` prints the debug keystore path; `keytool -list -v -keystore <path>`; EAS builds: `npx eas-cli@latest credentials`).
3. `app/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web id>`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios id>`.
4. `backend/.env`: `GOOGLE_CLIENT_IDS=<web id>,<ios id>,<android id>`.

**Apple Developer** (paid account):
1. Identifiers → the `com.alterwave.subs` App ID → enable **Sign in with Apple**.
2. Identifiers → new **Services ID** (e.g. `com.alterwave.subs.web`) → enable Sign in with Apple → add your web domain and the return URL.
3. Keys → new key with **Sign in with Apple** → download the `.p8` once; note its Key ID and your Team ID.
4. Services → Sign in with Apple for Email Communication → register the domain you send reminders from, so relay addresses (`…@privaterelay.appleid.com`) receive them.
5. `app/.env`: `EXPO_PUBLIC_APPLE_SERVICES_ID=<services id>`, `EXPO_PUBLIC_APPLE_REDIRECT_URI=<return url>`.
6. `backend/.env`: `APPLE_CLIENT_IDS=com.alterwave.subs,<services id>`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (the `.p8` contents or a path to it).

Then `docker compose exec php php artisan config:clear` and restart `npx expo start --clear`.

**Building on an iPhone without a paid account:** sign in to Xcode with your Apple ID (Settings → Accounts), connect the phone and run `FREE_SIGNING=1 npx expo run:ios --device` in `app/`. Turn on Developer Mode on the phone and trust your Apple ID under Settings → General → VPN & Device Management. That build has Google sign-in but no push or Apple sign-in, and stops opening after 7 days (rebuild to renew). Test push in Expo Go instead.
````

- [ ] **Step 4: Run the whole app suite, typecheck and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git checkout -- tsconfig.json
git add app README.md && git commit -m "feat(app): plugins from env, a free-signing iOS build, and sign-in setup docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Final verification (after Task 10)

- `docker compose exec php php artisan test --compact` — all pass.
- In `app/`: `npx jest && npx tsc --noEmit && npx expo lint` — all pass.
- `git status` — clean apart from untracked local env files.
- Report to the user which checks ran, and that Google on web needs their client IDs and Apple needs the paid account before they can be tried by hand.
