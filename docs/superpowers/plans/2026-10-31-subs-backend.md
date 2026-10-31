# Subs Backend Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Laravel API, reminder pipeline and local/production Docker setup for the Subs MVP, so the Expo app (Plan 2) can be built against a finished, tested API.

**Architecture:** A monorepo with a Laravel 12 JSON API in `backend/` and Docker Compose at the root (nginx, php-fpm, Postgres 17, Redis, Mailpit, Horizon, scheduler). The domain logic is pure services in `app/Services` (BillingCycle, CurrencyConverter, SpendCalculator), plus thin controllers under `Api/V1`. Reminders are a scheduled command that queues one Laravel Notification per reminder; the notification sends through the Expo, WebPush, database and mail channels.

**Tech Stack:** PHP 8.4, Laravel 12, Sanctum, Horizon, Pest 4, PostgreSQL 17, Redis 7, `laravel-notification-channels/webpush`, Docker Compose, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-31-subs-mvp-design.md`

## Global Constraints

- PHP 8.4 in Docker (`php:8.4-fpm-bookworm`); Laravel `^12.0`; PostgreSQL 17; Redis 7.
- All routes are under `/api/v1` and return JSON. Every route except the auth routes requires `auth:sanctum`.
- Money is stored as integer minor units plus an ISO 4217 code (`/^[A-Z]{3}$/`). Billing dates are `date` columns. Times of day are interpreted in the user's IANA timezone.
- Billing dates are always computed from `first_payment_date` (the anchor) with Carbon `add*NoOverflow`, never by stepping from the previous date.
- No user-facing literal strings in PHP: every message comes from `backend/lang/<locale>/*.php`. Supported locales live in `config('subs.locales')` (MVP: `['en']`).
- Preset category keys: entertainment, music, video_streaming, gaming, software_cloud, news_reading, fitness_health, education, utilities_telecom, shopping_delivery, finance, other.
- Signup default reminder rule: 1 day before at 09:00, channels push + in_app.
- Reminder rules: `days_before` 0–60, at most 5 rules per scope, `days_before` unique within a scope.
- Rate limits: auth endpoints 5/min per IP + email; API 120/min per user.
- Reminders are exactly-once per (subscription, rule, payment date) and are only sent if due within the last 24h.
- Run every backend command from the repo root as `docker compose exec php <command>` (the container's working directory is `/var/www/backend`). Git commands run on the host from the repo root.
- Tests use a real Postgres database `subs_testing` (never SQLite).

## Spec clarifications made in this plan

These are decisions the spec didn't spell out. Each one is pinned by a test:
1. `service_name` matches a **catalog** service first, then the user's own, case-insensitive. Typing "netflix" therefore reuses the catalog Netflix instead of creating a duplicate without a logo.
2. Dashboard `by_category[]` entries also carry `label`, and `most_expensive[]` / `upcoming[]` carry `name`, so the app doesn't need extra lookups.
3. `DELETE /me` requires `{password}` to prevent accidental deletion.
4. `GET /subscriptions/{id}/reminders` returns `meta.uses_defaults`.
5. `PUT` on reminder rules updates rows **in place by `days_before`** instead of delete-and-recreate. A rule keeps its id when edited, so its `sent_reminders` dedupe rows survive.
6. Password reset and email verification links point at `FRONTEND_URL` (the Expo web app).
7. An unsupported `locale` at registration falls back to `en` instead of returning 422, since devices report locales we may not support yet.

## Review Focus

1. **Currencies without 2 decimals (JPY = 0, KWD = 3):** converting ¥1,600 must give €10.00, not €0.10 or €1,000. Tested in Task 4.
2. **Editing reminder settings after a reminder went out:** changing the time or channels of an existing "1 day before" rule must not send the same reminder again. Tested in Task 12.
3. **Users far from UTC (Pacific/Auckland, Asia/Tokyo, America/Los_Angeles):** "today" and "09:00" mean the user's local time, for both `next_payment_date` and reminder timing. Tested in Tasks 3 and 12.
4. **Typing an existing service name with different casing ("netflix")** reuses the catalog entry and its category. Tested in Tasks 7 and 8.
5. **Lead time longer than the billing period** (weekly subscription, "14 days before") reminds about the correct future occurrence instead of silently never firing. Tested in Task 12.

---

## File Structure

```
docker-compose.yml                         local stack
docker-compose.prod.yml                    production override (Task 15)
docker/php/Dockerfile                      php-fpm 8.4 + pdo_pgsql, intl, gmp, redis, pcntl
docker/nginx/default.conf
docker/postgres/init.sql                   creates subs_testing
docker/caddy/Caddyfile                     (Task 15)
docker/bin/deploy.sh, docker/bin/backup.sh (Task 15)
.github/workflows/backend.yml              (Task 14)
backend/
  config/subs.php                          app-wide settings (locales, limits, decimals, ECB url)
  app/Enums/{Period,SubscriptionStatus,Channel,Platform}.php
  app/Models/{User,Category,Service,Subscription,ReminderRule,SentReminder,DeviceToken,ExchangeRate}.php
  app/Services/BillingCycle.php            pure date math
  app/Services/CurrencyConverter.php       minor-unit conversion via latest ECB rates
  app/Services/SpendCalculator.php         monthly equivalents + dashboard payload
  app/Services/DashboardCache.php          per-user cache + global version bump
  app/Services/ServiceResolver.php         find-or-create service by name
  app/Services/ReminderRuleSync.php        upsert rules by days_before
  app/Console/Commands/{FetchExchangeRates,DispatchReminders}.php
  app/Notifications/PaymentReminder.php
  app/Notifications/Channels/ExpoChannel.php, ExpoMessage.php
  app/Http/Middleware/SetLocale.php
  app/Http/Controllers/Api/V1/{Auth,Me,EmailVerification,PasswordReset,Category,Service,
      Subscription,Dashboard,ReminderRule,Device,WebPush,Notification}Controller.php
  app/Http/Requests/*.php, app/Http/Resources/*.php, app/Policies/CategoryPolicy.php
  database/migrations/*, database/factories/*, database/seeders/*
  lang/en/{categories,subscriptions,notifications}.php (+ published auth/passwords/validation)
  tests/Unit/BillingCycleTest.php
  tests/Feature/** (one file per task area)
```

---

### Task 1: Monorepo scaffold — Docker, Laravel 12, Pest

**Files:**
- Create: `.gitignore`, `docker-compose.yml`, `docker/php/Dockerfile`, `docker/nginx/default.conf`, `docker/postgres/init.sql`
- Create (generated): `backend/**` via composer
- Modify: `backend/.env.example`, `backend/phpunit.xml`, `backend/tests/Pest.php`
- Test: `backend/tests/Feature/SmokeTest.php`

**Interfaces:**
- Produces: a running `php` container with the working directory `/var/www/backend`; `./vendor/bin/pest` runs against the Postgres database `subs_testing`; the `routes/api.php` file exists with Sanctum installed.

- [ ] **Step 1: Root `.gitignore`**

```gitignore
.idea/
.DS_Store
```

- [ ] **Step 2: Docker files**

`docker/php/Dockerfile`:
```dockerfile
FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libicu-dev libgmp-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql intl gmp pcntl zip bcmath \
    && pecl install redis && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend
```

`docker/nginx/default.conf`:
```nginx
server {
    listen 80;
    root /var/www/backend/public;
    index index.php;
    client_max_body_size 10m;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

`docker/postgres/init.sql`:
```sql
CREATE DATABASE subs_testing OWNER subs;
```

`docker-compose.yml`:
```yaml
services:
  php:
    build: ./docker/php
    volumes:
      - ./backend:/var/www/backend
    depends_on: [postgres, redis]

  nginx:
    image: nginx:1.27-alpine
    ports: ["8080:80"]
    volumes:
      - ./backend:/var/www/backend:ro
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [php]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: subs
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: subs
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

  redis:
    image: redis:7-alpine

  mailpit:
    image: axllent/mailpit:latest
    ports: ["8025:8025"]

volumes:
  pgdata:
```

- [ ] **Step 3: Create the Laravel project (host composer, no install) and install inside the container**

```bash
composer create-project laravel/laravel:^12.0 backend --no-install --no-scripts
docker compose up -d --build
docker compose exec php composer install
docker compose exec php php artisan install:api --without-migration-prompt
docker compose exec php composer require --dev pestphp/pest:^4.0 pestphp/pest-plugin-laravel:^4.0 --with-all-dependencies
docker compose exec php ./vendor/bin/pest --init
docker compose exec php php artisan lang:publish
rm -f backend/tests/Feature/ExampleTest.php backend/tests/Unit/ExampleTest.php
```

- [ ] **Step 4: Configure the environment**

In `backend/.env.example`, replace the `DB_*`, `SESSION_DRIVER`, `CACHE_STORE`, `QUEUE_CONNECTION`, `REDIS_HOST`, `MAIL_*` and `APP_URL` lines with:
```dotenv
APP_URL=http://localhost:8080
FRONTEND_URL=http://localhost:8081

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=subs
DB_USERNAME=subs
DB_PASSWORD=secret

SESSION_DRIVER=file
CACHE_STORE=redis
QUEUE_CONNECTION=redis

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025
MAIL_FROM_ADDRESS="reminders@subs.test"
MAIL_FROM_NAME="Subs"

EXPO_ACCESS_TOKEN=
FREE_SUBSCRIPTION_LIMIT=
```
Then:
```bash
cp backend/.env.example backend/.env
docker compose exec php php artisan key:generate
```

In `backend/phpunit.xml`, inside `<php>`, replace the two sqlite `DB_*` lines and set:
```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="subs_testing"/>
<env name="CACHE_STORE" value="array"/>
<env name="QUEUE_CONNECTION" value="sync"/>
<env name="MAIL_MAILER" value="array"/>
```
(Don't set `DB_HOST` here, so that CI can override it.)

`backend/tests/Pest.php`:
```php
<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

pest()->extend(Tests\TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
```

- [ ] **Step 5: Write the smoke test**

`backend/tests/Feature/SmokeTest.php`:
```php
<?php

use Illuminate\Support\Facades\DB;

it('runs against the postgres test database', function () {
    expect(DB::connection()->getDriverName())->toBe('pgsql')
        ->and(DB::connection()->getDatabaseName())->toBe('subs_testing');
});
```

- [ ] **Step 6: Run it**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: 1 passed. (If Postgres was started before `init.sql` existed, run `docker compose down -v && docker compose up -d` and retry.)

- [ ] **Step 7: Commit**

```bash
git add .gitignore docker-compose.yml docker backend
git commit -m "chore: scaffold Laravel 12 backend with Docker, Postgres and Pest"
```

---

### Task 2: BillingCycle date math

**Files:**
- Create: `backend/app/Enums/Period.php`, `backend/app/Services/BillingCycle.php`
- Test: `backend/tests/Unit/BillingCycleTest.php`

**Interfaces:**
- Produces:
  - `enum App\Enums\Period: string { Week='week', Month='month', Year='year' }`
  - `BillingCycle::nth(CarbonImmutable $first, Period $period, int $interval, int $k): CarbonImmutable`
  - `BillingCycle::nextOnOrAfter(CarbonImmutable $first, Period $period, int $interval, CarbonImmutable $date): CarbonImmutable` — the smallest occurrence ≥ `$date`

- [ ] **Step 1: Write the failing test**

`backend/tests/Unit/BillingCycleTest.php`:
```php
<?php

use App\Enums\Period;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;

function day(string $date): CarbonImmutable
{
    return CarbonImmutable::parse($date);
}

it('keeps a month-end anchor without drifting', function () {
    $first = day('2026-01-31');

    expect(BillingCycle::nth($first, Period::Month, 1, 1)->toDateString())->toBe('2026-02-28')
        ->and(BillingCycle::nth($first, Period::Month, 1, 2)->toDateString())->toBe('2026-03-31')
        ->and(BillingCycle::nth($first, Period::Month, 1, 3)->toDateString())->toBe('2026-04-30');
});

it('handles a leap-day yearly anchor', function () {
    $first = day('2024-02-29');

    expect(BillingCycle::nth($first, Period::Year, 1, 1)->toDateString())->toBe('2025-02-28')
        ->and(BillingCycle::nth($first, Period::Year, 1, 4)->toDateString())->toBe('2028-02-29');
});

it('handles weekly and every-3-months intervals', function () {
    expect(BillingCycle::nth(day('2026-10-01'), Period::Week, 1, 5)->toDateString())->toBe('2026-11-05')
        ->and(BillingCycle::nth(day('2026-01-15'), Period::Month, 3, 4)->toDateString())->toBe('2027-01-15');
});

it('finds the next occurrence on or after a date', function (string $first, Period $period, int $interval, string $date, string $expected) {
    expect(BillingCycle::nextOnOrAfter(day($first), $period, $interval, day($date))->toDateString())->toBe($expected);
})->with([
    'first payment in the future' => ['2026-12-01', Period::Month, 1, '2026-10-31', '2026-12-01'],
    'payment is today' => ['2026-01-31', Period::Month, 1, '2026-10-31', '2026-10-31'],
    'month-end anchor' => ['2026-01-31', Period::Month, 1, '2026-03-01', '2026-03-31'],
    'weekly' => ['2026-10-01', Period::Week, 1, '2026-10-31', '2026-11-05'],
    'every 3 months' => ['2026-01-15', Period::Month, 3, '2026-10-31', '2027-01-15'],
    'yearly' => ['2020-06-10', Period::Year, 1, '2026-10-31', '2027-06-10'],
]);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Unit/BillingCycleTest.php`
Expected: FAIL — `Class "App\Enums\Period" not found`.

- [ ] **Step 3: Implement**

`backend/app/Enums/Period.php`:
```php
<?php

namespace App\Enums;

enum Period: string
{
    case Week = 'week';
    case Month = 'month';
    case Year = 'year';
}
```

`backend/app/Services/BillingCycle.php`:
```php
<?php

namespace App\Services;

use App\Enums\Period;
use Carbon\CarbonImmutable;

final class BillingCycle
{
    /** The k-th payment date (k = 0 is the first payment), always computed from the anchor. */
    public static function nth(CarbonImmutable $first, Period $period, int $interval, int $k): CarbonImmutable
    {
        $steps = $k * $interval;

        return match ($period) {
            Period::Week => $first->addWeeks($steps),
            Period::Month => $first->addMonthsNoOverflow($steps),
            Period::Year => $first->addYearsNoOverflow($steps),
        };
    }

    /** The first payment date that is on or after $date. */
    public static function nextOnOrAfter(CarbonImmutable $first, Period $period, int $interval, CarbonImmutable $date): CarbonImmutable
    {
        if ($first->gte($date)) {
            return $first;
        }

        $elapsed = match ($period) {
            Period::Week => (int) floor($first->diffInDays($date) / 7),
            Period::Month => (int) floor($first->diffInMonths($date)),
            Period::Year => (int) floor($first->diffInYears($date)),
        };

        // Start one step early so the estimate can never overshoot.
        $k = max(0, intdiv($elapsed, $interval) - 1);

        while (($candidate = self::nth($first, $period, $interval, $k))->lt($date)) {
            $k++;
        }

        return $candidate;
    }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `docker compose exec php ./vendor/bin/pest tests/Unit/BillingCycleTest.php`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Enums/Period.php backend/app/Services/BillingCycle.php backend/tests/Unit/BillingCycleTest.php
git commit -m "feat: add anchor-based billing cycle date math"
```

---

### Task 3: Schema, models, factories and catalog seeders

**Files:**
- Create: `backend/config/subs.php`, `backend/app/Enums/{SubscriptionStatus,Channel,Platform}.php`
- Modify: `backend/database/migrations/0001_01_01_000000_create_users_table.php`
- Create: `backend/database/migrations/2026_10_31_000001_create_categories_table.php` … `_000007_create_exchange_rates_table.php`, notifications table (generated)
- Create: `backend/app/Models/{Category,Service,Subscription,ReminderRule,SentReminder,DeviceToken,ExchangeRate}.php`; Modify: `backend/app/Models/User.php`
- Create: `backend/database/factories/{Category,Service,Subscription,ReminderRule}Factory.php`; Modify: `UserFactory.php`
- Create: `backend/database/seeders/{CatalogSeeder,CategorySeeder,ServiceCatalogSeeder,DemoSeeder}.php`; Modify: `DatabaseSeeder.php`
- Create: `backend/lang/en/categories.php`
- Modify: `backend/tests/TestCase.php`
- Test: `backend/tests/Feature/Models/CatalogSeederTest.php`, `backend/tests/Feature/Models/SubscriptionTest.php`

**Interfaces:**
- Consumes: `BillingCycle`, `Period` (Task 2).
- Produces:
  - Enums `SubscriptionStatus {Active='active', Paused='paused', Cancelled='cancelled'}`, `Channel {Push='push', InApp='in_app', Email='email'}`, `Platform {Ios='ios', Android='android'}`.
  - `User::today(): CarbonImmutable` (the user's local date, at midnight UTC); relations `subscriptions()`, `categories()`, `services()`, `reminderRules()`, `defaultReminderRules()`, `deviceTokens()`.
  - `Category::scopeVisibleTo(User)`, `Category::other(): Category`, `Category::label(): string`, `Category::isCustom(): bool`.
  - `Service::scopeVisibleTo(User)`, `Service::defaultCategory()`.
  - `Subscription` (auto-sets `next_payment_date` on save), `Subscription::effectiveReminderRules(): Collection<ReminderRule>`, `Subscription::isOccurrence(CarbonImmutable): bool`, relations `user`, `service`, `category`, `reminderRules`.
  - `ReminderRule::hasChannel(Channel): bool`; `time_of_day` reads as `'H:i'`.
  - `CatalogSeeder` (categories + ~60 services, idempotent); feature tests seed it automatically.

- [ ] **Step 1: Config and enums**

`backend/config/subs.php`:
```php
<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:8081'),

    // Add a locale here and create lang/<locale>/ to support a new language.
    'locales' => ['en'],

    // null = unlimited (MVP). Freemium at launch sets a number.
    'free_subscription_limit' => env('FREE_SUBSCRIPTION_LIMIT') ? (int) env('FREE_SUBSCRIPTION_LIMIT') : null,

    'default_reminder' => ['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['push', 'in_app']],
    'max_reminder_rules' => 5,

    // ISO 4217 minor-unit exponents that are not 2.
    'currency_decimals' => [
        'BHD' => 3, 'CLP' => 0, 'ISK' => 0, 'JOD' => 3, 'JPY' => 0, 'KRW' => 0, 'KWD' => 3,
        'OMR' => 3, 'PYG' => 0, 'TND' => 3, 'UGX' => 0, 'VND' => 0, 'XAF' => 0, 'XOF' => 0,
    ],

    'ecb_url' => 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
];
```

`backend/app/Enums/SubscriptionStatus.php`:
```php
<?php

namespace App\Enums;

enum SubscriptionStatus: string
{
    case Active = 'active';
    case Paused = 'paused';
    case Cancelled = 'cancelled';
}
```

`backend/app/Enums/Channel.php`:
```php
<?php

namespace App\Enums;

enum Channel: string
{
    case Push = 'push';
    case InApp = 'in_app';
    case Email = 'email';
}
```

`backend/app/Enums/Platform.php`:
```php
<?php

namespace App\Enums;

enum Platform: string
{
    case Ios = 'ios';
    case Android = 'android';
}
```

- [ ] **Step 2: Migrations**

In `0001_01_01_000000_create_users_table.php`, add after `$table->string('password');`:
```php
$table->string('timezone', 64)->default('UTC');
$table->char('currency', 3)->default('EUR');
$table->string('locale', 10)->default('en');
$table->boolean('is_premium')->default(false);
```

Each file below is a standard anonymous migration (`return new class extends Migration { public function up(): void {…} public function down(): void { Schema::dropIfExists('<table>'); } };` with `use Illuminate\Database\Migrations\Migration; use Illuminate\Database\Schema\Blueprint; use Illuminate\Support\Facades\Schema;`). The `up()` bodies:

`2026_10_31_000001_create_categories_table.php`:
```php
Schema::create('categories', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
    $table->string('key', 50)->nullable();
    $table->string('name', 50)->nullable();
    $table->string('icon', 50)->default('pricetag');
    $table->char('color', 7)->default('#64748B');
    $table->timestamps();
    $table->index('user_id');
});
```

`2026_10_31_000002_create_services_table.php`:
```php
Schema::create('services', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
    $table->string('name', 100);
    $table->string('slug', 120);
    $table->string('logo_path')->nullable();
    $table->foreignId('default_category_id')->nullable()->constrained('categories')->nullOnDelete();
    $table->timestamps();
    $table->index('user_id');
});
```

`2026_10_31_000003_create_subscriptions_table.php` (`service_id`/`category_id` use the default NO ACTION, which Postgres checks at the end of the statement, so deleting a user cascades cleanly):
```php
Schema::create('subscriptions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('service_id')->constrained();
    $table->foreignId('category_id')->constrained();
    $table->bigInteger('amount');
    $table->char('currency', 3);
    $table->string('period', 10);
    $table->unsignedSmallInteger('interval_count')->default(1);
    $table->date('first_payment_date');
    $table->date('next_payment_date');
    $table->string('status', 10)->default('active');
    $table->text('notes')->nullable();
    $table->timestamps();
    $table->softDeletes();
    $table->index(['user_id', 'status']);
});
```

`2026_10_31_000004_create_reminder_rules_table.php`:
```php
Schema::create('reminder_rules', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('subscription_id')->nullable()->constrained()->cascadeOnDelete();
    $table->unsignedSmallInteger('days_before');
    $table->time('time_of_day');
    $table->jsonb('channels');
    $table->timestamps();
    $table->index(['user_id', 'subscription_id']);
});
```

`2026_10_31_000005_create_sent_reminders_table.php`:
```php
Schema::create('sent_reminders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('subscription_id')->constrained()->cascadeOnDelete();
    $table->foreignId('reminder_rule_id')->constrained()->cascadeOnDelete();
    $table->date('payment_date');
    $table->timestamp('created_at')->useCurrent();
    $table->unique(['subscription_id', 'reminder_rule_id', 'payment_date']);
});
```

`2026_10_31_000006_create_device_tokens_table.php`:
```php
Schema::create('device_tokens', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('token')->unique();
    $table->string('platform', 10);
    $table->timestamp('last_seen_at')->nullable();
    $table->timestamps();
});
```

`2026_10_31_000007_create_exchange_rates_table.php`:
```php
Schema::create('exchange_rates', function (Blueprint $table) {
    $table->id();
    $table->date('date');
    $table->char('base', 3)->default('EUR');
    $table->char('quote', 3);
    $table->decimal('rate', 18, 8);
    $table->unique(['date', 'quote']);
});
```

Then generate the in-app inbox table:
```bash
docker compose exec php php artisan make:notifications-table
```

- [ ] **Step 3: Models**

`backend/app/Models/User.php` (replace the class body; keep the generated `namespace`):
```php
<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'timezone', 'currency', 'locale'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_premium' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function reminderRules(): HasMany
    {
        return $this->hasMany(ReminderRule::class);
    }

    public function defaultReminderRules(): HasMany
    {
        return $this->reminderRules()->whereNull('subscription_id');
    }

    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function preferredLocale(): string
    {
        return $this->locale;
    }

    /** The user's local calendar date, as a midnight date comparable with `date` columns. */
    public function today(): CarbonImmutable
    {
        return CarbonImmutable::parse(CarbonImmutable::now($this->timezone)->toDateString());
    }
}
```

`backend/app/Models/Category.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'key', 'name', 'icon', 'color'];

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    public static function other(): self
    {
        return static::query()->whereNull('user_id')->where('key', 'other')->firstOrFail();
    }

    public function label(): string
    {
        return $this->key !== null ? __('categories.'.$this->key) : (string) $this->name;
    }

    public function isCustom(): bool
    {
        return $this->user_id !== null;
    }
}
```

`backend/app/Models/Service.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Service extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'slug', 'logo_path', 'default_category_id'];

    protected static function booted(): void
    {
        static::creating(function (Service $service) {
            $service->slug ??= Str::slug($service->name);
        });
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    public function defaultCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'default_category_id');
    }
}
```

`backend/app/Models/Subscription.php`:
```php
<?php

namespace App\Models;

use App\Enums\Period;
use App\Enums\SubscriptionStatus;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subscription extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'service_id', 'category_id', 'amount', 'currency', 'period',
        'interval_count', 'first_payment_date', 'status', 'notes',
    ];

    protected $attributes = ['interval_count' => 1, 'status' => 'active'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'interval_count' => 'integer',
            'period' => Period::class,
            'status' => SubscriptionStatus::class,
            'first_payment_date' => 'immutable_date',
            'next_payment_date' => 'immutable_date',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Subscription $subscription) {
            if ($subscription->next_payment_date === null
                || $subscription->isDirty(['first_payment_date', 'period', 'interval_count'])) {
                $subscription->next_payment_date = BillingCycle::nextOnOrAfter(
                    $subscription->first_payment_date,
                    $subscription->period,
                    $subscription->interval_count,
                    $subscription->user->today(),
                );
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function reminderRules(): HasMany
    {
        return $this->hasMany(ReminderRule::class);
    }

    /** Own rules replace the user's defaults when present. */
    public function effectiveReminderRules(): Collection
    {
        return $this->reminderRules->isNotEmpty()
            ? $this->reminderRules
            : $this->user->defaultReminderRules;
    }

    public function isOccurrence(CarbonImmutable $date): bool
    {
        return BillingCycle::nextOnOrAfter($this->first_payment_date, $this->period, $this->interval_count, $date)
            ->equalTo($date);
    }
}
```

`backend/app/Models/ReminderRule.php`:
```php
<?php

namespace App\Models;

use App\Enums\Channel;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReminderRule extends Model
{
    use HasFactory;

    protected $fillable = ['subscription_id', 'days_before', 'time_of_day', 'channels'];

    protected function casts(): array
    {
        return ['days_before' => 'integer', 'channels' => 'array'];
    }

    /** Postgres returns "09:00:00"; the API speaks "09:00". */
    protected function timeOfDay(): Attribute
    {
        return Attribute::get(fn (?string $value) => $value === null ? null : substr($value, 0, 5));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function hasChannel(Channel $channel): bool
    {
        return in_array($channel->value, $this->channels, true);
    }
}
```

`backend/app/Models/SentReminder.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SentReminder extends Model
{
    public $timestamps = false;

    protected $fillable = ['subscription_id', 'reminder_rule_id', 'payment_date'];

    protected function casts(): array
    {
        return ['payment_date' => 'immutable_date'];
    }
}
```

`backend/app/Models/DeviceToken.php`:
```php
<?php

namespace App\Models;

use App\Enums\Platform;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceToken extends Model
{
    protected $fillable = ['user_id', 'token', 'platform', 'last_seen_at'];

    protected function casts(): array
    {
        return ['platform' => Platform::class, 'last_seen_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

`backend/app/Models/ExchangeRate.php`:
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    public $timestamps = false;

    protected $fillable = ['date', 'base', 'quote', 'rate'];

    protected function casts(): array
    {
        return ['date' => 'immutable_date', 'rate' => 'float'];
    }
}
```

- [ ] **Step 4: Factories**

In `backend/database/factories/UserFactory.php`, add to the `definition()` array:
```php
'timezone' => 'UTC',
'currency' => 'EUR',
'locale' => 'en',
```

`backend/database/factories/CategoryFactory.php`:
```php
<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class CategoryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'key' => null,
            'name' => ucfirst(fake()->unique()->word()),
        ];
    }
}
```

`backend/database/factories/ServiceFactory.php`:
```php
<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => null,
            'name' => fake()->unique()->company(),
            'default_category_id' => null,
        ];
    }
}
```

`backend/database/factories/SubscriptionFactory.php`:
```php
<?php

namespace Database\Factories;

use App\Enums\Period;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'service_id' => Service::factory(),
            'category_id' => fn (array $attributes) => Category::factory()->create(['user_id' => $attributes['user_id']])->id,
            'amount' => 999,
            'currency' => 'EUR',
            'period' => Period::Month,
            'interval_count' => 1,
            'first_payment_date' => '2026-01-15',
            'status' => 'active',
        ];
    }
}
```

`backend/database/factories/ReminderRuleFactory.php`:
```php
<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReminderRuleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'subscription_id' => null,
            'days_before' => 1,
            'time_of_day' => '09:00',
            'channels' => ['push', 'in_app'],
        ];
    }
}
```

- [ ] **Step 5: Seeders and category labels**

`backend/lang/en/categories.php`:
```php
<?php

return [
    'entertainment' => 'Entertainment',
    'music' => 'Music',
    'video_streaming' => 'Video Streaming',
    'gaming' => 'Gaming',
    'software_cloud' => 'Software & Cloud',
    'news_reading' => 'News & Reading',
    'fitness_health' => 'Fitness & Health',
    'education' => 'Education',
    'utilities_telecom' => 'Utilities & Telecom',
    'shopping_delivery' => 'Shopping & Delivery',
    'finance' => 'Finance',
    'other' => 'Other',
];
```

`backend/database/seeders/CategorySeeder.php` (icons are Ionicons names used by the app):
```php
<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public const CATEGORIES = [
        'entertainment' => ['sparkles', '#F59E0B'],
        'music' => ['musical-notes', '#10B981'],
        'video_streaming' => ['tv', '#EF4444'],
        'gaming' => ['game-controller', '#8B5CF6'],
        'software_cloud' => ['cloud', '#3B82F6'],
        'news_reading' => ['newspaper', '#6B7280'],
        'fitness_health' => ['fitness', '#EC4899'],
        'education' => ['school', '#14B8A6'],
        'utilities_telecom' => ['flash', '#EAB308'],
        'shopping_delivery' => ['cart', '#F97316'],
        'finance' => ['card', '#0EA5E9'],
        'other' => ['ellipsis-horizontal', '#64748B'],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $key => [$icon, $color]) {
            Category::query()->updateOrCreate(
                ['user_id' => null, 'key' => $key],
                ['icon' => $icon, 'color' => $color],
            );
        }
    }
}
```

`backend/database/seeders/ServiceCatalogSeeder.php`:
```php
<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ServiceCatalogSeeder extends Seeder
{
    public const SERVICES = [
        'Netflix' => 'video_streaming', 'YouTube Premium' => 'video_streaming', 'Disney+' => 'video_streaming',
        'Amazon Prime Video' => 'video_streaming', 'Max' => 'video_streaming', 'Hulu' => 'video_streaming',
        'Apple TV+' => 'video_streaming', 'Paramount+' => 'video_streaming', 'Peacock' => 'video_streaming',
        'Crunchyroll' => 'video_streaming', 'DAZN' => 'video_streaming', 'MUBI' => 'video_streaming',
        'Spotify' => 'music', 'Apple Music' => 'music', 'YouTube Music' => 'music',
        'Amazon Music Unlimited' => 'music', 'Tidal' => 'music', 'Deezer' => 'music', 'SoundCloud Go+' => 'music',
        'Xbox Game Pass' => 'gaming', 'PlayStation Plus' => 'gaming', 'Nintendo Switch Online' => 'gaming',
        'EA Play' => 'gaming', 'Ubisoft+' => 'gaming', 'Apple Arcade' => 'gaming', 'GeForce NOW' => 'gaming',
        'iCloud+' => 'software_cloud', 'Google One' => 'software_cloud', 'Microsoft 365' => 'software_cloud',
        'Dropbox' => 'software_cloud', 'Adobe Creative Cloud' => 'software_cloud', '1Password' => 'software_cloud',
        'NordVPN' => 'software_cloud', 'ChatGPT Plus' => 'software_cloud', 'Claude Pro' => 'software_cloud',
        'Notion' => 'software_cloud', 'GitHub Copilot' => 'software_cloud', 'Canva Pro' => 'software_cloud',
        'The New York Times' => 'news_reading', 'The Washington Post' => 'news_reading', 'The Economist' => 'news_reading',
        'Medium' => 'news_reading', 'Kindle Unlimited' => 'news_reading', 'Audible' => 'news_reading', 'Scribd' => 'news_reading',
        'Strava' => 'fitness_health', 'Peloton' => 'fitness_health', 'Headspace' => 'fitness_health',
        'Calm' => 'fitness_health', 'Fitbit Premium' => 'fitness_health', 'MyFitnessPal Premium' => 'fitness_health',
        'Duolingo Super' => 'education', 'Coursera Plus' => 'education', 'MasterClass' => 'education',
        'LinkedIn Premium' => 'education', 'Skillshare' => 'education',
        'Amazon Prime' => 'shopping_delivery', 'Uber One' => 'shopping_delivery',
        'DoorDash DashPass' => 'shopping_delivery', 'Instacart+' => 'shopping_delivery',
        'Patreon' => 'entertainment', 'Twitch Turbo' => 'entertainment',
        'YNAB' => 'finance',
    ];

    public function run(): void
    {
        $categories = Category::query()->whereNull('user_id')->pluck('id', 'key');

        foreach (self::SERVICES as $name => $categoryKey) {
            Service::query()->updateOrCreate(
                ['user_id' => null, 'slug' => Str::slug($name)],
                ['name' => $name, 'default_category_id' => $categories[$categoryKey]],
            );
        }
    }
}
```

`backend/database/seeders/CatalogSeeder.php`:
```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([CategorySeeder::class, ServiceCatalogSeeder::class]);
    }
}
```

`backend/database/seeders/DemoSeeder.php`:
```php
<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->updateOrCreate(['email' => 'demo@subs.test'], [
            'name' => 'Demo', 'password' => 'password', 'timezone' => 'Europe/Paris', 'currency' => 'EUR', 'locale' => 'en',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        if ($user->subscriptions()->exists()) {
            return;
        }

        $user->reminderRules()->create(config('subs.default_reminder'));

        $rows = [
            ['Netflix', 1399, 'EUR', 'month', 1, '2026-01-05'],
            ['Spotify', 1199, 'USD', 'month', 1, '2026-02-12'],
            ['iCloud+', 2999, 'EUR', 'year', 1, '2025-11-20'],
            ['Xbox Game Pass', 1499, 'EUR', 'month', 3, '2026-03-01'],
            ['Duolingo Super', 799, 'GBP', 'month', 1, '2026-06-18'],
        ];

        foreach ($rows as [$name, $amount, $currency, $period, $interval, $first]) {
            $service = Service::query()->whereNull('user_id')->where('name', $name)->firstOrFail();
            $user->subscriptions()->create([
                'service_id' => $service->id,
                'category_id' => $service->default_category_id ?? Category::other()->id,
                'amount' => $amount, 'currency' => $currency, 'period' => $period,
                'interval_count' => $interval, 'first_payment_date' => $first,
            ]);
        }
    }
}
```

`backend/database/seeders/DatabaseSeeder.php` `run()` body:
```php
$this->call(CatalogSeeder::class);

if (app()->isLocal()) {
    $this->call(DemoSeeder::class);
}
```

`backend/tests/TestCase.php`:
```php
<?php

namespace Tests;

use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Every feature test starts with the preset categories and service catalog. */
    protected $seed = true;

    protected $seeder = CatalogSeeder::class;
}
```

- [ ] **Step 6: Write the failing tests**

`backend/tests/Feature/Models/CatalogSeederTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\Service;
use Database\Seeders\CatalogSeeder;

it('seeds 12 preset categories and a catalog where every service has a category', function () {
    expect(Category::whereNull('user_id')->count())->toBe(12)
        ->and(Service::whereNull('user_id')->count())->toBeGreaterThanOrEqual(60)
        ->and(Service::whereNull('user_id')->whereNull('default_category_id')->count())->toBe(0);
});

it('is idempotent', function () {
    $this->seed(CatalogSeeder::class);

    expect(Category::whereNull('user_id')->count())->toBe(12)
        ->and(Service::where('slug', 'netflix')->count())->toBe(1);
});

it('labels preset categories by translation key and custom ones by name', function () {
    $custom = Category::factory()->create(['name' => 'Kids']);

    expect(Category::other()->label())->toBe('Other')
        ->and(Category::where('key', 'video_streaming')->first()->label())->toBe('Video Streaming')
        ->and($custom->label())->toBe('Kids')
        ->and($custom->isCustom())->toBeTrue();
});
```

`backend/tests/Feature/Models/SubscriptionTest.php`:
```php
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
```

- [ ] **Step 7: Run tests, verify they pass**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass. (If a test fails, fix the model or migration it names before moving on.)

Also run: `docker compose exec php php artisan migrate:fresh --seed`
Expected: completes; the demo user exists.

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat: add schema, models, factories and catalog seeders"
```

---

### Task 4: Exchange rates — CurrencyConverter and `rates:fetch`

**Files:**
- Create: `backend/app/Services/CurrencyConverter.php`, `backend/app/Console/Commands/FetchExchangeRates.php`, `backend/tests/Fixtures/ecb-daily.xml`
- Test: `backend/tests/Feature/Services/CurrencyConverterTest.php`, `backend/tests/Feature/Commands/FetchExchangeRatesTest.php`

**Interfaces:**
- Consumes: `ExchangeRate` model, `config('subs.currency_decimals')`, `config('subs.ecb_url')`.
- Produces:
  - `CurrencyConverter::decimals(string $currency): int` (static)
  - `CurrencyConverter->convert(float $minor, string $from, string $to): ?float` (minor units in, minor units out, `null` if a rate is missing)
  - `CurrencyConverter->rate(string $currency): ?float` (EUR-based)
  - `CurrencyConverter::forgetRates(): void`
  - Artisan `rates:fetch`

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/Services/CurrencyConverterTest.php`:
```php
<?php

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;

beforeEach(function () {
    ExchangeRate::insert([
        ['date' => '2026-10-29', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.00],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'JPY', 'rate' => 160],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'KWD', 'rate' => 0.5],
    ]);
    $this->converter = new CurrencyConverter;
});

it('returns the same amount for the same currency', function () {
    expect($this->converter->convert(1299, 'EUR', 'EUR'))->toBe(1299.0);
});

it('uses the latest rate per currency', function () {
    // $12.50 at 1.25 = €10.00
    expect($this->converter->convert(1250, 'USD', 'EUR'))->toBe(1000.0);
});

it('respects currencies without two decimals', function () {
    expect($this->converter->convert(1600, 'JPY', 'EUR'))->toBe(1000.0)   // ¥1,600 → €10.00
        ->and($this->converter->convert(1000, 'EUR', 'JPY'))->toBe(1600.0) // €10.00 → ¥1,600
        ->and($this->converter->convert(5000, 'KWD', 'EUR'))->toBe(1000.0); // 5.000 KWD → €10.00
});

it('converts between two non-EUR currencies via EUR', function () {
    expect($this->converter->convert(1250, 'USD', 'JPY'))->toBe(1600.0);
});

it('returns null when a rate is missing', function () {
    expect($this->converter->convert(1000, 'XYZ', 'EUR'))->toBeNull()
        ->and($this->converter->convert(1000, 'EUR', 'XYZ'))->toBeNull();
});
```

`backend/tests/Fixtures/ecb-daily.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
  <Cube>
    <Cube time="2026-10-30">
      <Cube currency="USD" rate="1.0812"/>
      <Cube currency="JPY" rate="162.35"/>
      <Cube currency="GBP" rate="0.8421"/>
    </Cube>
  </Cube>
</gesmes:Envelope>
```

`backend/tests/Feature/Commands/FetchExchangeRatesTest.php`:
```php
<?php

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

beforeEach(function () {
    Http::fake([config('subs.ecb_url') => Http::response(file_get_contents(base_path('tests/Fixtures/ecb-daily.xml')))]);
});

it('stores the daily ECB rates', function () {
    $this->artisan('rates:fetch')->assertSuccessful();

    expect(ExchangeRate::count())->toBe(3)
        ->and(ExchangeRate::where('quote', 'USD')->first())
        ->date->toDateString()->toBe('2026-10-30')
        ->rate->toBe(1.0812);
});

it('does not duplicate rows when run twice on the same day', function () {
    $this->artisan('rates:fetch');
    $this->artisan('rates:fetch');

    expect(ExchangeRate::count())->toBe(3);
});

it('refreshes the cached rates', function () {
    $converter = new CurrencyConverter;
    expect($converter->rate('USD'))->toBeNull();

    $this->artisan('rates:fetch');

    expect((new CurrencyConverter)->rate('USD'))->toBe(1.0812);
});

it('fails loudly when the ECB is down', function () {
    Sleep::fake();
    Http::fake([config('subs.ecb_url') => Http::response('', 500)]);

    $this->artisan('rates:fetch');
})->throws(RequestException::class);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Services/CurrencyConverterTest.php tests/Feature/Commands/FetchExchangeRatesTest.php`
Expected: FAIL — `Class "App\Services\CurrencyConverter" not found` / `Command "rates:fetch" is not defined`.

- [ ] **Step 3: Implement**

`backend/app/Services/CurrencyConverter.php`:
```php
<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Support\Facades\Cache;

final class CurrencyConverter
{
    public const CACHE_KEY = 'exchange_rates:latest';

    /** @var array<string, float>|null */
    private ?array $rates = null;

    public static function decimals(string $currency): int
    {
        return config('subs.currency_decimals')[$currency] ?? 2;
    }

    public static function forgetRates(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** Converts minor units of $from into minor units of $to; null when either rate is unknown. */
    public function convert(float $minor, string $from, string $to): ?float
    {
        if ($from === $to) {
            return $minor;
        }

        $fromRate = $this->rate($from);
        $toRate = $this->rate($to);

        if ($fromRate === null || $toRate === null) {
            return null;
        }

        $major = $minor / 10 ** self::decimals($from);

        return round($major / $fromRate * $toRate * 10 ** self::decimals($to), 6);
    }

    /** Units of $currency per 1 EUR, from the most recent stored day. */
    public function rate(string $currency): ?float
    {
        if ($currency === 'EUR') {
            return 1.0;
        }

        $this->rates ??= Cache::remember(self::CACHE_KEY, now()->addDay(), fn () => ExchangeRate::query()
            ->selectRaw('DISTINCT ON (quote) quote, rate')
            ->orderBy('quote')
            ->orderByDesc('date')
            ->pluck('rate', 'quote')
            ->map(fn ($rate) => (float) $rate)
            ->all());

        return $this->rates[$currency] ?? null;
    }
}
```

`backend/app/Console/Commands/FetchExchangeRates.php`:
```php
<?php

namespace App\Console\Commands;

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

class FetchExchangeRates extends Command
{
    protected $signature = 'rates:fetch';

    protected $description = 'Fetch the daily ECB euro reference rates';

    public function handle(): int
    {
        $body = Http::timeout(20)->retry(3, 1000)->get(config('subs.ecb_url'))->throw()->body();

        $day = (new SimpleXMLElement($body))->Cube->Cube;
        $date = (string) $day['time'];

        $rows = [];
        foreach ($day->Cube as $cube) {
            $rows[] = ['date' => $date, 'base' => 'EUR', 'quote' => (string) $cube['currency'], 'rate' => (string) $cube['rate']];
        }

        if ($rows === []) {
            $this->error('The ECB response contained no rates.');

            return self::FAILURE;
        }

        ExchangeRate::query()->upsert($rows, ['date', 'quote'], ['rate']);
        CurrencyConverter::forgetRates();

        $this->info(sprintf('Stored %d rates for %s.', count($rows), $date));

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Services/CurrencyConverterTest.php tests/Feature/Commands/FetchExchangeRatesTest.php`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/CurrencyConverter.php backend/app/Console/Commands/FetchExchangeRates.php backend/tests
git commit -m "feat: add ECB exchange rates and minor-unit currency conversion"
```

---

### Task 5: SpendCalculator and DashboardCache

**Files:**
- Create: `backend/app/Services/SpendCalculator.php`, `backend/app/Services/DashboardCache.php`
- Modify: `backend/app/Models/Subscription.php` (cache hooks), `backend/app/Models/User.php` (cache hook), `backend/app/Console/Commands/FetchExchangeRates.php` (flush)
- Test: `backend/tests/Feature/Services/SpendCalculatorTest.php`

**Interfaces:**
- Consumes: `CurrencyConverter` (Task 4), `BillingCycle` (Task 2), models (Task 3).
- Produces:
  - `SpendCalculator->monthlyEquivalent(Subscription): float` (own currency, minor units)
  - `SpendCalculator->monthlyIn(Subscription, string $currency): ?float`
  - `SpendCalculator->dashboard(User): array` with the shape `{currency, monthly_total, yearly_total, count, by_category[{category_id,label,monthly,percent}], upcoming[{subscription_id,name,date,amount,currency}], most_expensive[{subscription_id,name,monthly}], unconverted[{subscription_id,currency}]}`
  - `DashboardCache::remember(User, Closure): array`, `DashboardCache::forget(User)`, `DashboardCache::flushAll()`

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Services/SpendCalculatorTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\ExchangeRate;
use App\Models\Subscription;
use App\Models\User;
use App\Services\DashboardCache;
use App\Services\SpendCalculator;

function category(string $key): int
{
    return Category::whereNull('user_id')->where('key', $key)->value('id');
}

beforeEach(function () {
    $this->travelTo('2026-10-31 12:00:00');
    ExchangeRate::insert(['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25]);
    $this->user = User::factory()->create(['currency' => 'EUR']);
    $this->calc = app(SpendCalculator::class);
});

it('normalizes every period to a monthly equivalent', function () {
    $make = fn (string $period, int $interval, int $amount) => Subscription::factory()->make(compact('period', 'amount') + ['interval_count' => $interval]);

    expect($this->calc->monthlyEquivalent($make('week', 1, 1000)))->toEqualWithDelta(4333.33, 0.01)
        ->and($this->calc->monthlyEquivalent($make('month', 1, 1500)))->toBe(1500.0)
        ->and($this->calc->monthlyEquivalent($make('month', 3, 3000)))->toBe(1000.0)
        ->and($this->calc->monthlyEquivalent($make('year', 1, 12000)))->toBe(1000.0);
});

it('builds the dashboard in the user currency', function () {
    $sub = fn (array $attrs) => Subscription::factory()->for($this->user)->create($attrs);
    $netflix = $sub(['amount' => 1500, 'currency' => 'EUR', 'category_id' => category('video_streaming'), 'first_payment_date' => '2026-01-05']);
    $sub(['amount' => 1250, 'currency' => 'USD', 'category_id' => category('music')]);
    $sub(['amount' => 12000, 'currency' => 'EUR', 'period' => 'year', 'category_id' => category('software_cloud'), 'first_payment_date' => '2026-03-01']);
    $sub(['amount' => 9999, 'status' => 'paused']);
    $odd = $sub(['amount' => 500, 'currency' => 'XYZ']);

    $d = $this->calc->dashboard($this->user);

    expect($d['currency'])->toBe('EUR')
        ->and($d['monthly_total'])->toBe(3500)
        ->and($d['yearly_total'])->toBe(42000)
        ->and($d['count'])->toBe(4)
        ->and($d['unconverted'])->toBe([['subscription_id' => $odd->id, 'currency' => 'XYZ']])
        ->and($d['most_expensive'][0])->toMatchArray(['subscription_id' => $netflix->id, 'monthly' => 1500]);

    $byKey = collect($d['by_category'])->keyBy('label');
    expect($byKey['Video Streaming'])->toMatchArray(['monthly' => 1500, 'percent' => 42.9])
        ->and($byKey['Music'])->toMatchArray(['monthly' => 1000, 'percent' => 28.6]);
});

it('lists every payment in the next 30 days, including repeats of weekly subscriptions', function () {
    Subscription::factory()->for($this->user)->create(['period' => 'week', 'first_payment_date' => '2026-10-01']);
    Subscription::factory()->for($this->user)->create(['first_payment_date' => '2026-01-05']);

    $dates = collect($this->calc->dashboard($this->user)['upcoming'])->pluck('date')->all();

    expect($dates)->toBe(['2026-11-05', '2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
});

it('invalidates the cached dashboard when subscriptions or currency change', function () {
    $build = fn () => DashboardCache::remember($this->user, fn () => $this->calc->dashboard($this->user->fresh()));

    expect($build()['count'])->toBe(0);
    Subscription::factory()->for($this->user)->create();
    expect($build()['count'])->toBe(1);

    $this->user->update(['currency' => 'USD']);
    expect($build()['currency'])->toBe('USD');

    DashboardCache::flushAll();
    expect($build()['count'])->toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Services/SpendCalculatorTest.php`
Expected: FAIL — `Class "App\Services\SpendCalculator" not found`.

- [ ] **Step 3: Implement**

`backend/app/Services/DashboardCache.php`:
```php
<?php

namespace App\Services;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Cache;

final class DashboardCache
{
    private const VERSION_KEY = 'dashboard:version';

    public static function remember(User $user, Closure $build): array
    {
        return Cache::remember(self::key($user), now()->addHour(), $build);
    }

    public static function forget(User $user): void
    {
        Cache::forget(self::key($user));
    }

    /** Invalidates every user's dashboard (e.g. after new exchange rates). */
    public static function flushAll(): void
    {
        Cache::forever(self::VERSION_KEY, (int) Cache::get(self::VERSION_KEY, 0) + 1);
    }

    private static function key(User $user): string
    {
        return 'dashboard:'.Cache::get(self::VERSION_KEY, 0).':'.$user->id;
    }
}
```

`backend/app/Services/SpendCalculator.php`:
```php
<?php

namespace App\Services;

use App\Enums\Period;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\User;

final class SpendCalculator
{
    public function __construct(private readonly CurrencyConverter $converter) {}

    /** Monthly cost in the subscription's own currency, minor units. */
    public function monthlyEquivalent(Subscription $subscription): float
    {
        $amount = (float) $subscription->amount;
        $interval = $subscription->interval_count;

        return match ($subscription->period) {
            Period::Week => $amount * 52 / 12 / $interval,
            Period::Month => $amount / $interval,
            Period::Year => $amount / (12 * $interval),
        };
    }

    public function monthlyIn(Subscription $subscription, string $currency): ?float
    {
        return $this->converter->convert($this->monthlyEquivalent($subscription), $subscription->currency, $currency);
    }

    public function dashboard(User $user): array
    {
        $today = $user->today();
        $until = $today->addDays(30);
        $subscriptions = $user->subscriptions()
            ->where('status', SubscriptionStatus::Active)
            ->with(['service', 'category'])
            ->get();

        $total = 0.0;
        $byCategory = [];
        $priced = [];
        $unconverted = [];
        $upcoming = [];

        foreach ($subscriptions as $subscription) {
            $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $today);
            while ($date->lte($until)) {
                $upcoming[] = [
                    'subscription_id' => $subscription->id,
                    'name' => $subscription->service->name,
                    'date' => $date->toDateString(),
                    'amount' => $subscription->amount,
                    'currency' => $subscription->currency,
                ];
                $date = BillingCycle::nextOnOrAfter($subscription->first_payment_date, $subscription->period, $subscription->interval_count, $date->addDay());
            }

            $monthly = $this->monthlyIn($subscription, $user->currency);
            if ($monthly === null) {
                $unconverted[] = ['subscription_id' => $subscription->id, 'currency' => $subscription->currency];

                continue;
            }

            $total += $monthly;
            $byCategory[$subscription->category_id] ??= [
                'category_id' => $subscription->category_id,
                'label' => $subscription->category->label(),
                'monthly' => 0.0,
            ];
            $byCategory[$subscription->category_id]['monthly'] += $monthly;
            $priced[] = ['subscription_id' => $subscription->id, 'name' => $subscription->service->name, 'monthly' => $monthly];
        }

        usort($upcoming, fn (array $a, array $b) => [$a['date'], $a['subscription_id']] <=> [$b['date'], $b['subscription_id']]);
        usort($priced, fn (array $a, array $b) => $b['monthly'] <=> $a['monthly']);

        return [
            'currency' => $user->currency,
            'monthly_total' => (int) round($total),
            'yearly_total' => (int) round($total * 12),
            'count' => $subscriptions->count(),
            'by_category' => collect($byCategory)
                ->sortByDesc('monthly')
                ->map(fn (array $c) => [
                    ...$c,
                    'monthly' => (int) round($c['monthly']),
                    'percent' => $total > 0 ? round($c['monthly'] / $total * 100, 1) : 0.0,
                ])
                ->values()
                ->all(),
            'upcoming' => $upcoming,
            'most_expensive' => array_map(
                fn (array $p) => [...$p, 'monthly' => (int) round($p['monthly'])],
                array_slice($priced, 0, 5),
            ),
            'unconverted' => $unconverted,
        ];
    }
}
```

In `Subscription::booted()`, add after the `saving` hook:
```php
static::saved(fn (Subscription $subscription) => DashboardCache::forget($subscription->user));
static::deleted(fn (Subscription $subscription) => DashboardCache::forget($subscription->user));
static::restored(fn (Subscription $subscription) => DashboardCache::forget($subscription->user));
```
(add `use App\Services\DashboardCache;`)

In `User`, add:
```php
protected static function booted(): void
{
    static::updated(function (User $user) {
        if ($user->wasChanged(['currency', 'timezone'])) {
            DashboardCache::forget($user);
        }
    });
}
```
(add `use App\Services\DashboardCache;`)

In `FetchExchangeRates::handle()`, after `CurrencyConverter::forgetRates();` add:
```php
DashboardCache::flushAll();
```
(add `use App\Services\DashboardCache;`)

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add spend calculator and per-user dashboard cache"
```

---

### Task 6: Auth and account API

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/{AuthController,MeController,EmailVerificationController,PasswordResetController}.php`
- Create: `backend/app/Http/Requests/{RegisterRequest,LoginRequest,UpdateMeRequest}.php`, `backend/app/Http/Resources/UserResource.php`, `backend/app/Http/Middleware/SetLocale.php`
- Modify: `backend/routes/api.php`, `backend/bootstrap/app.php`, `backend/app/Providers/AppServiceProvider.php`, `backend/tests/Pest.php`
- Test: `backend/tests/Feature/Api/AuthTest.php`, `backend/tests/Feature/Api/MeTest.php`

**Interfaces:**
- Consumes: `User`, `config('subs.default_reminder')`, `config('subs.locales')`, `config('subs.frontend_url')`.
- Produces:
  - The routes listed in the spec's Auth block.
  - `UserResource` JSON `{id,name,email,email_verified,timezone,currency,locale,is_premium}`.
  - Rate limiters `auth` and `api`.
  - The test helper `actingAsUser(array $attributes = []): User` in `tests/Pest.php`.
  - In `routes/api.php`, an authenticated route group that later tasks add to, marked with `// Authenticated routes`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/Pest.php`:
```php
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function actingAsUser(array $attributes = []): User
{
    $user = User::factory()->create($attributes);
    Sanctum::actingAs($user);

    return $user;
}
```

`backend/tests/Feature/Api/AuthTest.php`:
```php
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
```

`backend/tests/Feature/Api/MeTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;

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
    $user = actingAsUser(['password' => 'secret-pass-1']);
    $service = Service::factory()->create(['user_id' => $user->id]);
    Subscription::factory()->for($user)->create(['service_id' => $service->id]);
    $user->createToken('phone');

    $this->deleteJson('/api/v1/me', ['password' => 'secret-pass-1'])->assertNoContent();

    expect(User::count())->toBe(0)
        ->and(Subscription::withTrashed()->count())->toBe(0)
        ->and(Category::whereNotNull('user_id')->count())->toBe(0)
        ->and(Service::whereNotNull('user_id')->count())->toBe(0);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api`
Expected: FAIL — 404s on `/api/v1/...`.

- [ ] **Step 3: Implement**

`backend/routes/api.php`:
```php
<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\EmailVerificationController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\PasswordResetController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::middleware('throttle:auth')->group(function () {
        Route::post('auth/register', [AuthController::class, 'register']);
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot']);
        Route::post('auth/reset-password', [PasswordResetController::class, 'reset']);
    });

    Route::get('auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware('signed')
        ->name('verification.verify');

    // Authenticated routes
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/email/resend', [EmailVerificationController::class, 'resend'])->middleware('throttle:auth');

        Route::get('me', [MeController::class, 'show']);
        Route::patch('me', [MeController::class, 'update']);
        Route::delete('me', [MeController::class, 'destroy']);
    });
});
```

`backend/bootstrap/app.php`: inside `->withMiddleware(function (Middleware $middleware) { … })` add
```php
$middleware->api(append: [\App\Http\Middleware\SetLocale::class]);
```
and inside `->withExceptions(function (Exceptions $exceptions) { … })` add
```php
$exceptions->shouldRenderJsonWhen(fn (\Illuminate\Http\Request $request) => $request->is('api/*'));
```

`backend/app/Http/Middleware/SetLocale.php`:
```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $supported = config('subs.locales');
        $locale = $request->user('sanctum')?->locale ?? $request->getPreferredLanguage($supported);

        App::setLocale(in_array($locale, $supported, true) ? $locale : config('app.locale'));

        return $next($request);
    }
}
```

`backend/app/Providers/AppServiceProvider.php` `boot()`:
```php
RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)
    ->by(Str::lower((string) $request->input('email')).'|'.$request->ip()));

RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
    ->by($request->user()?->id ?: $request->ip()));

ResetPassword::createUrlUsing(fn (User $user, string $token) => config('subs.frontend_url').'/reset-password?'
    .http_build_query(['token' => $token, 'email' => $user->email]));
```
with imports `App\Models\User`, `Illuminate\Auth\Notifications\ResetPassword`, `Illuminate\Cache\RateLimiting\Limit`, `Illuminate\Http\Request`, `Illuminate\Support\Facades\RateLimiter`, `Illuminate\Support\Str`.

`backend/app/Http/Resources/UserResource.php`:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->hasVerifiedEmail(),
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'locale' => $this->locale,
            'is_premium' => (bool) $this->is_premium,
        ];
    }
}
```

`backend/app/Http/Requests/RegisterRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $locale = $this->input('locale');

        $this->merge([
            'email' => Str::lower((string) $this->input('email')),
            'locale' => in_array($locale, config('subs.locales'), true) ? $locale : config('app.locale'),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'timezone' => ['required', 'timezone:all'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'locale' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ];
    }
}
```

`backend/app/Http/Requests/LoginRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:100'],
        ];
    }
}
```

`backend/app/Http/Requests/UpdateMeRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'timezone' => ['sometimes', 'timezone:all'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'locale' => ['sometimes', Rule::in(config('subs.locales'))],
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/AuthController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $user = User::create($request->safe()->except('device_name'));
            $user->reminderRules()->create(config('subs.default_reminder'));

            return $user;
        });

        event(new Registered($user));

        return response()->json([
            'token' => $user->createToken($request->input('device_name'))->plainTextToken,
            'user' => new UserResource($user->refresh()),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::firstWhere('email', Str::lower($request->input('email')));

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        return response()->json([
            'token' => $user->createToken($request->input('device_name'))->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }
}
```

`backend/app/Http/Controllers/Api/V1/MeController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateMeRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class MeController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function update(UpdateMeRequest $request): UserResource
    {
        $request->user()->update($request->validated());

        return new UserResource($request->user());
    }

    public function destroy(Request $request): Response
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);
        $user = $request->user();

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            $user->notifications()->delete();
            $user->delete();
        });

        return response()->noContent();
    }
}
```

`backend/app/Http/Controllers/Api/V1/EmailVerificationController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EmailVerificationController extends Controller
{
    public function verify(int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);
        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403);

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            event(new Verified($user));
        }

        return redirect()->away(config('subs.frontend_url').'/?verified=1');
    }

    public function resend(Request $request): Response
    {
        if (! $request->user()->hasVerifiedEmail()) {
            $request->user()->sendEmailVerificationNotification();
        }

        return response()->noContent();
    }
}
```

`backend/app/Http/Controllers/Api/V1/PasswordResetController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => Str::lower($request->input('email'))]);

        // Same answer whether or not the account exists.
        return response()->json(['message' => __('passwords.sent')]);
    }

    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', PasswordRule::defaults()],
        ]);

        $status = Password::reset(
            ['email' => Str::lower($request->input('email'))] + $request->only('password', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => __($status)]);
    }
}
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add auth, email verification, password reset and account API"
```

---

### Task 7: Categories and services API

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/{CategoryController,ServiceController}.php`, `backend/app/Http/Requests/{CategoryRequest,ServiceRequest}.php`, `backend/app/Http/Resources/{CategoryResource,ServiceResource}.php`, `backend/app/Policies/CategoryPolicy.php`, `backend/app/Services/ServiceResolver.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/CategoryTest.php`, `backend/tests/Feature/Api/ServiceTest.php`

**Interfaces:**
- Consumes: `Category::visibleTo/other/label`, `Service::visibleTo`, `DashboardCache::forget`, `actingAsUser()`.
- Produces:
  - `ServiceResolver->resolve(User $user, string $name, ?int $defaultCategoryId = null): Service` (catalog match first, then the user's own, case-insensitive; otherwise creates a service owned by the user)
  - `CategoryResource {id,key,label,icon,color,is_custom}`
  - `ServiceResource {id,name,logo_url,default_category_id,is_custom}`

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/Api/CategoryTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\Subscription;

it('lists presets plus my own categories only', function () {
    $me = actingAsUser();
    Category::factory()->create(['user_id' => $me->id, 'name' => 'Kids']);
    Category::factory()->create(['name' => 'Someone else']);

    $labels = collect($this->getJson('/api/v1/categories')->assertOk()->json('data'))->pluck('label');

    expect($labels)->toHaveCount(13)->toContain('Kids', 'Other')->not->toContain('Someone else');
});

it('creates, renames and validates a custom category', function () {
    actingAsUser();

    $id = $this->postJson('/api/v1/categories', ['name' => 'Kids', 'color' => '#112233'])
        ->assertCreated()
        ->assertJsonPath('data.is_custom', true)
        ->json('data.id');

    $this->patchJson("/api/v1/categories/{$id}", ['name' => 'Family'])->assertOk()->assertJsonPath('data.label', 'Family');
    $this->postJson('/api/v1/categories', ['name' => '', 'color' => 'red'])->assertJsonValidationErrors(['name', 'color']);
});

it('forbids editing presets and hides other users categories', function () {
    actingAsUser();
    $foreign = Category::factory()->create();

    $this->patchJson('/api/v1/categories/'.Category::other()->id, ['name' => 'X'])->assertForbidden();
    $this->patchJson("/api/v1/categories/{$foreign->id}", ['name' => 'X'])->assertNotFound();
    $this->deleteJson("/api/v1/categories/{$foreign->id}")->assertNotFound();
});

it('moves subscriptions (including deleted ones) to Other when a category is deleted', function () {
    $me = actingAsUser();
    $kids = Category::factory()->create(['user_id' => $me->id]);
    $active = Subscription::factory()->for($me)->create(['category_id' => $kids->id]);
    $trashed = Subscription::factory()->for($me)->create(['category_id' => $kids->id]);
    $trashed->delete();

    $this->deleteJson("/api/v1/categories/{$kids->id}")->assertNoContent();

    expect($active->fresh()->category_id)->toBe(Category::other()->id)
        ->and(Subscription::withTrashed()->find($trashed->id)->category_id)->toBe(Category::other()->id)
        ->and(Category::find($kids->id))->toBeNull();
});
```

`backend/tests/Feature/Api/ServiceTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\Service;

it('searches the catalog case-insensitively', function () {
    actingAsUser();

    $names = collect($this->getJson('/api/v1/services?q=NET')->assertOk()->json('data'))->pluck('name');

    expect($names)->toContain('Netflix');
});

it('hides other users services', function () {
    actingAsUser();
    Service::factory()->create(['user_id' => \App\Models\User::factory()->create()->id, 'name' => 'Secret Gym']);

    expect($this->getJson('/api/v1/services?q=secret')->json('data'))->toBe([]);
});

it('reuses the catalog entry when the typed name matches in any case', function () {
    actingAsUser();
    $netflix = Service::whereNull('user_id')->where('name', 'Netflix')->first();

    $this->postJson('/api/v1/services', ['name' => '  netflix '])
        ->assertOk()
        ->assertJsonPath('data.id', $netflix->id)
        ->assertJsonPath('data.is_custom', false);

    expect(Service::where('name', 'ilike', 'netflix')->count())->toBe(1);
});

it('creates a custom service in Other by default, and reuses it next time', function () {
    $me = actingAsUser();

    $id = $this->postJson('/api/v1/services', ['name' => 'Local Gym'])
        ->assertCreated()
        ->assertJsonPath('data.default_category_id', Category::other()->id)
        ->json('data.id');

    $this->postJson('/api/v1/services', ['name' => 'LOCAL GYM'])->assertOk()->assertJsonPath('data.id', $id);
    expect($me->services()->count())->toBe(1);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api/CategoryTest.php tests/Feature/Api/ServiceTest.php`
Expected: FAIL — 404 (routes missing).

- [ ] **Step 3: Implement**

`backend/app/Services/ServiceResolver.php`:
```php
<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Service;
use App\Models\User;

final class ServiceResolver
{
    /** Catalog match first, then the user's own; otherwise a new service owned by the user. */
    public function resolve(User $user, string $name, ?int $defaultCategoryId = null): Service
    {
        $name = trim($name);

        $existing = Service::query()
            ->visibleTo($user)
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->orderByRaw('user_id IS NOT NULL')
            ->first();

        return $existing ?? $user->services()->create([
            'name' => $name,
            'default_category_id' => $defaultCategoryId ?? Category::other()->id,
        ]);
    }
}
```

`backend/app/Policies/CategoryPolicy.php`:
```php
<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

class CategoryPolicy
{
    public function update(User $user, Category $category): bool
    {
        return $category->user_id === $user->id;
    }

    public function delete(User $user, Category $category): bool
    {
        return $category->user_id === $user->id;
    }
}
```

`backend/app/Http/Requests/CategoryRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:50'],
            'icon' => ['sometimes', 'string', 'max:50'],
            'color' => ['sometimes', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }
}
```

`backend/app/Http/Requests/ServiceRequest.php`:
```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ServiceRequest extends FormRequest
{
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'name' => ['required', 'string', 'max:100'],
            'default_category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')
                ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId))],
        ];
    }
}
```

`backend/app/Http/Resources/CategoryResource.php`:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'label' => $this->label(),
            'icon' => $this->icon,
            'color' => $this->color,
            'is_custom' => $this->isCustom(),
        ];
    }
}
```

`backend/app/Http/Resources/ServiceResource.php`:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\Service */
class ServiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'default_category_id' => $this->default_category_id,
            'is_custom' => $this->user_id !== null,
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/CategoryController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Models\Service;
use App\Models\Subscription;
use App\Services\DashboardCache;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return CategoryResource::collection(
            Category::visibleTo($request->user())->orderByRaw('user_id IS NOT NULL')->orderBy('id')->get()
        );
    }

    public function store(CategoryRequest $request): CategoryResource
    {
        return new CategoryResource($request->user()->categories()->create($request->validated()));
    }

    public function update(CategoryRequest $request, int $category): CategoryResource
    {
        $model = Category::visibleTo($request->user())->findOrFail($category);
        Gate::authorize('update', $model);
        $model->update($request->validated());

        return new CategoryResource($model);
    }

    public function destroy(Request $request, int $category): Response
    {
        $model = Category::visibleTo($request->user())->findOrFail($category);
        Gate::authorize('delete', $model);

        DB::transaction(function () use ($model) {
            $otherId = Category::other()->id;
            Subscription::withTrashed()->where('category_id', $model->id)->update(['category_id' => $otherId]);
            Service::where('default_category_id', $model->id)->update(['default_category_id' => $otherId]);
            $model->delete();
        });

        DashboardCache::forget($request->user());

        return response()->noContent();
    }
}
```

`backend/app/Http/Controllers/Api/V1/ServiceController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceRequest;
use App\Http\Resources\ServiceResource;
use App\Models\Service;
use App\Services\ServiceResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ServiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100']]);
        $q = $request->input('q');

        return ServiceResource::collection(
            Service::visibleTo($request->user())
                ->when($q, fn ($query) => $query->where('name', 'ilike', '%'.addcslashes($q, '%_\\').'%'))
                ->orderByRaw('user_id IS NULL')
                ->orderBy('name')
                ->limit(50)
                ->get()
        );
    }

    public function store(ServiceRequest $request, ServiceResolver $resolver): JsonResponse
    {
        $service = $resolver->resolve($request->user(), $request->input('name'), $request->input('default_category_id'));

        return (new ServiceResource($service))->response()->setStatusCode($service->wasRecentlyCreated ? 201 : 200);
    }
}
```

In `backend/routes/api.php`, add `use` lines for both controllers and, inside the authenticated group after the `me` routes:
```php
Route::get('categories', [CategoryController::class, 'index']);
Route::post('categories', [CategoryController::class, 'store']);
Route::patch('categories/{category}', [CategoryController::class, 'update']);
Route::delete('categories/{category}', [CategoryController::class, 'destroy']);

Route::get('services', [ServiceController::class, 'index']);
Route::post('services', [ServiceController::class, 'store']);
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add categories and services API with catalog-aware service resolution"
```

---

### Task 8: Subscriptions API

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/SubscriptionController.php`, `backend/app/Http/Requests/{StoreSubscriptionRequest,UpdateSubscriptionRequest}.php`, `backend/app/Http/Resources/SubscriptionResource.php`, `backend/lang/en/subscriptions.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/SubscriptionTest.php`

**Interfaces:**
- Consumes: `ServiceResolver` (Task 7), `SpendCalculator->monthlyIn` (Task 5), `Category::other`, `config('subs.free_subscription_limit')`.
- Produces:
  - `SubscriptionResource {id, service{id,name,logo_url}, category{id,label,icon,color}, amount, currency, period, interval_count, first_payment_date, next_payment_date, status, notes, monthly_equivalent}` (`monthly_equivalent` is in the user's currency, minor units, or `null`)
  - Routes `GET|POST /subscriptions`, `GET|PATCH|DELETE /subscriptions/{subscription}`

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Api/SubscriptionTest.php`:
```php
<?php

use App\Models\Category;
use App\Models\ExchangeRate;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;

function netflix(): Service
{
    return Service::whereNull('user_id')->where('name', 'Netflix')->first();
}

function payload(array $overrides = []): array
{
    return ['amount' => 1299, 'currency' => 'EUR', 'period' => 'month', 'first_payment_date' => '2026-01-31', ...$overrides];
}

beforeEach(fn () => $this->travelTo('2026-10-31 12:00:00'));

it('creates a subscription from a catalog service with its default category', function () {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_id' => netflix()->id]))
        ->assertCreated()
        ->assertJsonPath('data.service.name', 'Netflix')
        ->assertJsonPath('data.category.label', 'Video Streaming')
        ->assertJsonPath('data.next_payment_date', '2026-10-31')
        ->assertJsonPath('data.interval_count', 1)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.monthly_equivalent', 1299);
});

it('reuses the catalog service when the name is typed in another case', function () {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'NETFLIX']))
        ->assertCreated()
        ->assertJsonPath('data.service.id', netflix()->id)
        ->assertJsonPath('data.category.label', 'Video Streaming');
});

it('creates an own service in Other for unknown names', function () {
    $me = actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'Local Gym']))
        ->assertCreated()
        ->assertJsonPath('data.category.id', Category::other()->id);

    expect($me->services()->pluck('name')->all())->toBe(['Local Gym']);
});

it('validates input', function (array $overrides, string $field) {
    actingAsUser();

    $this->postJson('/api/v1/subscriptions', payload($overrides))->assertJsonValidationErrors($field);
})->with([
    'no service' => [[], 'service_id'],
    'foreign service' => [fn () => ['service_id' => Service::factory()->create(['user_id' => User::factory()->create()->id])->id], 'service_id'],
    'negative amount' => [['service_name' => 'X', 'amount' => -1], 'amount'],
    'bad currency' => [['service_name' => 'X', 'currency' => 'eur'], 'currency'],
    'bad period' => [['service_name' => 'X', 'period' => 'daily'], 'period'],
    'zero interval' => [['service_name' => 'X', 'interval_count' => 0], 'interval_count'],
    'bad date' => [['service_name' => 'X', 'first_payment_date' => '31/01/2026'], 'first_payment_date'],
]);

it('sorts by price across currencies and filters by status', function () {
    ExchangeRate::insert(['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25]);
    $me = actingAsUser(['currency' => 'EUR']);
    $cheapEur = Subscription::factory()->for($me)->create(['amount' => 900, 'currency' => 'EUR']);
    $usd = Subscription::factory()->for($me)->create(['amount' => 1250, 'currency' => 'USD']);  // = €10.00
    $yearly = Subscription::factory()->for($me)->create(['amount' => 24000, 'period' => 'year']); // = €20.00/mo
    Subscription::factory()->for($me)->create(['status' => 'paused']);

    $ids = collect($this->getJson('/api/v1/subscriptions?status=active&sort=price')->assertOk()->json('data'))->pluck('id')->all();

    expect($ids)->toBe([$yearly->id, $usd->id, $cheapEur->id]);
});

it('hides other users subscriptions', function () {
    actingAsUser();
    $foreign = Subscription::factory()->create();

    $this->getJson("/api/v1/subscriptions/{$foreign->id}")->assertNotFound();
    $this->patchJson("/api/v1/subscriptions/{$foreign->id}", ['amount' => 1])->assertNotFound();
    $this->deleteJson("/api/v1/subscriptions/{$foreign->id}")->assertNotFound();
});

it('updates, pauses and recomputes the next payment date', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create(['first_payment_date' => '2026-01-31']);

    $this->patchJson("/api/v1/subscriptions/{$sub->id}", ['first_payment_date' => '2026-01-05', 'status' => 'paused'])
        ->assertOk()
        ->assertJsonPath('data.next_payment_date', '2026-11-05')
        ->assertJsonPath('data.status', 'paused');
});

it('soft deletes', function () {
    $me = actingAsUser();
    $sub = Subscription::factory()->for($me)->create();

    $this->deleteJson("/api/v1/subscriptions/{$sub->id}")->assertNoContent();

    expect($this->getJson('/api/v1/subscriptions')->json('data'))->toBe([])
        ->and(Subscription::withTrashed()->find($sub->id))->not->toBeNull();
});

it('enforces the free limit only when configured and only for non-premium users', function () {
    config(['subs.free_subscription_limit' => 1]);
    $me = actingAsUser();
    Subscription::factory()->for($me)->create();

    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'X']))->assertForbidden();

    $me->forceFill(['is_premium' => true])->save();
    $this->postJson('/api/v1/subscriptions', payload(['service_name' => 'X']))->assertCreated();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api/SubscriptionTest.php`
Expected: FAIL — 404 (routes missing).

- [ ] **Step 3: Implement**

`backend/lang/en/subscriptions.php`:
```php
<?php

return [
    'limit_reached' => 'The free plan includes up to :limit subscriptions. Upgrade to add more.',
];
```

`backend/app/Http/Requests/StoreSubscriptionRequest.php`:
```php
<?php

namespace App\Http\Requests;

use App\Enums\Period;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

class StoreSubscriptionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'service_id' => ['required_without:service_name', 'nullable', 'integer', $this->visible('services')],
            'service_name' => ['required_without:service_id', 'nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer', $this->visible('categories')],
            'amount' => ['required', 'integer', 'min:0', 'max:100000000'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'period' => ['required', Rule::enum(Period::class)],
            'interval_count' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'first_payment_date' => ['required', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** Exists among global rows or rows owned by the current user. */
    protected function visible(string $table): Exists
    {
        $userId = $this->user()->id;

        return Rule::exists($table, 'id')->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $userId));
    }
}
```

`backend/app/Http/Requests/UpdateSubscriptionRequest.php`:
```php
<?php

namespace App\Http\Requests;

use App\Enums\Period;
use App\Enums\SubscriptionStatus;
use Illuminate\Validation\Rule;

class UpdateSubscriptionRequest extends StoreSubscriptionRequest
{
    public function rules(): array
    {
        return [
            'service_id' => ['sometimes', 'integer', $this->visible('services')],
            'service_name' => ['sometimes', 'string', 'max:100'],
            'category_id' => ['sometimes', 'integer', $this->visible('categories')],
            'amount' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'period' => ['sometimes', Rule::enum(Period::class)],
            'interval_count' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'first_payment_date' => ['sometimes', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::enum(SubscriptionStatus::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }
}
```

`backend/app/Http/Resources/SubscriptionResource.php`:
```php
<?php

namespace App\Http\Resources;

use App\Services\SpendCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Subscription */
class SubscriptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $monthly = app(SpendCalculator::class)->monthlyIn($this->resource, $request->user()->currency);

        return [
            'id' => $this->id,
            'service' => [
                'id' => $this->service->id,
                'name' => $this->service->name,
                'logo_url' => (new ServiceResource($this->service))->toArray($request)['logo_url'],
            ],
            'category' => [
                'id' => $this->category->id,
                'label' => $this->category->label(),
                'icon' => $this->category->icon,
                'color' => $this->category->color,
            ],
            'amount' => $this->amount,
            'currency' => $this->currency,
            'period' => $this->period->value,
            'interval_count' => $this->interval_count,
            'first_payment_date' => $this->first_payment_date->toDateString(),
            'next_payment_date' => $this->next_payment_date->toDateString(),
            'status' => $this->status->value,
            'notes' => $this->notes,
            'monthly_equivalent' => $monthly === null ? null : (int) round($monthly),
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/SubscriptionController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubscriptionRequest;
use App\Http\Requests\UpdateSubscriptionRequest;
use App\Http\Resources\SubscriptionResource;
use App\Models\Category;
use App\Models\Service;
use App\Services\ServiceResolver;
use App\Services\SpendCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

class SubscriptionController extends Controller
{
    public function index(Request $request, SpendCalculator $spend): AnonymousResourceCollection
    {
        $request->validate([
            'status' => ['nullable', Rule::enum(SubscriptionStatus::class)],
            'category_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['price', 'next_payment', 'name'])],
        ]);
        $user = $request->user();

        $subscriptions = $user->subscriptions()
            ->with(['service', 'category'])
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->input('category_id'), fn ($q, $id) => $q->where('category_id', $id))
            ->get();

        $sorted = match ($request->input('sort', 'next_payment')) {
            'price' => $subscriptions->sortByDesc(fn ($s) => $spend->monthlyIn($s, $user->currency) ?? -1),
            'name' => $subscriptions->sortBy(fn ($s) => mb_strtolower($s->service->name)),
            default => $subscriptions->sortBy(fn ($s) => $s->next_payment_date->toDateString()),
        };

        return SubscriptionResource::collection($sorted->values());
    }

    public function store(StoreSubscriptionRequest $request, ServiceResolver $resolver): JsonResponse
    {
        $user = $request->user();
        $limit = config('subs.free_subscription_limit');
        abort_if(
            $limit !== null && ! $user->is_premium && $user->subscriptions()->count() >= $limit,
            403,
            __('subscriptions.limit_reached', ['limit' => $limit]),
        );

        $data = $request->validated();
        $service = $this->service($request, $resolver, $data);

        $subscription = $user->subscriptions()->create([
            ...Arr::except($data, ['service_id', 'service_name']),
            'service_id' => $service->id,
            'category_id' => $data['category_id'] ?? $service->default_category_id ?? Category::other()->id,
        ]);

        return (new SubscriptionResource($subscription->load(['service', 'category'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $subscription): SubscriptionResource
    {
        return new SubscriptionResource($request->user()->subscriptions()->with(['service', 'category'])->findOrFail($subscription));
    }

    public function update(UpdateSubscriptionRequest $request, ServiceResolver $resolver, int $subscription): SubscriptionResource
    {
        $model = $request->user()->subscriptions()->findOrFail($subscription);
        $data = $request->validated();

        if (isset($data['service_id']) || isset($data['service_name'])) {
            $data['service_id'] = $this->service($request, $resolver, $data)->id;
        }

        $model->update(Arr::except($data, ['service_name']));

        return new SubscriptionResource($model->refresh()->load(['service', 'category']));
    }

    public function destroy(Request $request, int $subscription): Response
    {
        $request->user()->subscriptions()->findOrFail($subscription)->delete();

        return response()->noContent();
    }

    private function service(Request $request, ServiceResolver $resolver, array $data): Service
    {
        return isset($data['service_id'])
            ? Service::findOrFail($data['service_id'])
            : $resolver->resolve($request->user(), $data['service_name']);
    }
}
```

In `backend/routes/api.php`, add `use App\Http\Controllers\Api\V1\SubscriptionController;` and, inside the authenticated group:
```php
Route::get('subscriptions', [SubscriptionController::class, 'index']);
Route::post('subscriptions', [SubscriptionController::class, 'store']);
Route::get('subscriptions/{subscription}', [SubscriptionController::class, 'show'])->whereNumber('subscription');
Route::patch('subscriptions/{subscription}', [SubscriptionController::class, 'update'])->whereNumber('subscription');
Route::delete('subscriptions/{subscription}', [SubscriptionController::class, 'destroy'])->whereNumber('subscription');
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add subscriptions API with sorting, filtering and free-limit hook"
```

---

### Task 9: Dashboard endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/DashboardController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/DashboardTest.php`

**Interfaces:**
- Consumes: `SpendCalculator->dashboard`, `DashboardCache::remember` (Task 5).
- Produces: `GET /api/v1/dashboard` returning the `dashboard()` array as the top-level JSON (not wrapped in `data`).

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Api/DashboardTest.php`:
```php
<?php

use App\Models\Subscription;

it('returns the dashboard and reflects changes immediately', function () {
    $this->travelTo('2026-10-31 12:00:00');
    $me = actingAsUser(['currency' => 'EUR']);
    Subscription::factory()->for($me)->create(['amount' => 1500]);

    $this->getJson('/api/v1/dashboard')
        ->assertOk()
        ->assertJsonStructure(['currency', 'monthly_total', 'yearly_total', 'count', 'by_category', 'upcoming', 'most_expensive', 'unconverted'])
        ->assertJsonPath('monthly_total', 1500);

    $this->postJson('/api/v1/subscriptions', [
        'service_name' => 'Gym', 'amount' => 500, 'currency' => 'EUR', 'period' => 'month', 'first_payment_date' => '2026-01-10',
    ])->assertCreated();

    $this->getJson('/api/v1/dashboard')->assertJsonPath('monthly_total', 2000)->assertJsonPath('count', 2);
});

it('requires authentication', function () {
    $this->getJson('/api/v1/dashboard')->assertUnauthorized();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api/DashboardTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

`backend/app/Http/Controllers/Api/V1/DashboardController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DashboardCache;
use App\Services\SpendCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, SpendCalculator $spend): JsonResponse
    {
        $user = $request->user();

        return response()->json(DashboardCache::remember($user, fn () => $spend->dashboard($user)));
    }
}
```

In `backend/routes/api.php`, add `use App\Http\Controllers\Api\V1\DashboardController;` and, inside the authenticated group:
```php
Route::get('dashboard', DashboardController::class);
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add cached dashboard endpoint"
```

---

### Task 10: Reminder rules, devices and web-push subscriptions API

**Files:**
- Create: `backend/app/Services/ReminderRuleSync.php`, `backend/app/Http/Requests/ReminderRulesRequest.php`, `backend/app/Http/Resources/ReminderRuleResource.php`, `backend/app/Http/Controllers/Api/V1/{ReminderRuleController,DeviceController,WebPushController}.php`
- Modify: `backend/app/Models/User.php` (HasPushSubscriptions), `backend/app/Http/Controllers/Api/V1/MeController.php` (delete push subscriptions), `backend/routes/api.php`
- Generated: webpush config + migration, VAPID keys in `.env`
- Test: `backend/tests/Feature/Api/ReminderRuleTest.php`, `backend/tests/Feature/Api/DeviceTest.php`

**Interfaces:**
- Consumes: `ReminderRule`, `DeviceToken`, `Channel`, `Platform`, `config('subs.max_reminder_rules')`.
- Produces:
  - `ReminderRuleSync->sync(User $user, ?Subscription $subscription, array $rules): Collection` (upserts by `days_before`, keeping ids)
  - `ReminderRuleResource {id,days_before,time_of_day,channels}`
  - `GET|PUT /reminder-defaults`, `GET|PUT /subscriptions/{id}/reminders` (with `meta.uses_defaults`), `POST /devices`, `DELETE /devices/{token}`, `POST|DELETE /webpush/subscribe`
  - `User::pushSubscriptions()`, `User::updatePushSubscription()` (from the package)

- [ ] **Step 1: Install web push**

```bash
docker compose exec php composer require laravel-notification-channels/webpush
docker compose exec php php artisan vendor:publish --provider="NotificationChannels\WebPush\WebPushServiceProvider" --tag="migrations"
docker compose exec php php artisan vendor:publish --provider="NotificationChannels\WebPush\WebPushServiceProvider" --tag="config"
docker compose exec php php artisan webpush:vapid
```
Add `VAPID_PUBLIC_KEY=` and `VAPID_PRIVATE_KEY=` (empty values) to `backend/.env.example`.

In `User`, add `use NotificationChannels\WebPush\HasPushSubscriptions;` and include `HasPushSubscriptions` in the class's `use` list.

In `MeController::destroy`, inside the transaction before `$user->delete();`, add:
```php
$user->pushSubscriptions()->delete();
```

- [ ] **Step 2: Write the failing tests**

`backend/tests/Feature/Api/ReminderRuleTest.php`:
```php
<?php

use App\Models\ReminderRule;
use App\Models\Subscription;

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
```

`backend/tests/Feature/Api/DeviceTest.php`:
```php
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
```

- [ ] **Step 3: Run them to verify they fail**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api/ReminderRuleTest.php tests/Feature/Api/DeviceTest.php`
Expected: FAIL — 404.

- [ ] **Step 4: Implement**

`backend/app/Services/ReminderRuleSync.php`:
```php
<?php

namespace App\Services;

use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class ReminderRuleSync
{
    /**
     * Replaces the rules of one scope (user defaults when $subscription is null).
     * Rules are matched by days_before and updated in place, so their ids — and the
     * sent_reminders rows that reference them — survive an edit.
     *
     * @param  list<array{days_before:int, time_of_day:string, channels:list<string>}>  $rules
     */
    public function sync(User $user, ?Subscription $subscription, array $rules): Collection
    {
        return DB::transaction(function () use ($user, $subscription, $rules) {
            $scope = fn () => $user->reminderRules()->where('subscription_id', $subscription?->id);
            $existing = $scope()->get()->keyBy('days_before');
            $keep = [];

            foreach ($rules as $data) {
                $rule = $existing->get($data['days_before'])
                    ?? $user->reminderRules()->make(['subscription_id' => $subscription?->id]);
                $rule->fill($data)->save();
                $keep[] = $rule->id;
            }

            $scope()->whereNotIn('id', $keep)->delete();

            return $scope()->orderBy('days_before')->get();
        });
    }
}
```

`backend/app/Http/Requests/ReminderRulesRequest.php`:
```php
<?php

namespace App\Http\Requests;

use App\Enums\Channel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReminderRulesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'rules' => ['present', 'array', 'max:'.config('subs.max_reminder_rules')],
            'rules.*.days_before' => ['required', 'integer', 'min:0', 'max:60', 'distinct'],
            'rules.*.time_of_day' => ['required', 'date_format:H:i'],
            'rules.*.channels' => ['required', 'array', 'min:1'],
            'rules.*.channels.*' => ['required', Rule::enum(Channel::class), 'distinct'],
        ];
    }
}
```

`backend/app/Http/Resources/ReminderRuleResource.php`:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ReminderRule */
class ReminderRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'days_before' => $this->days_before,
            'time_of_day' => $this->time_of_day,
            'channels' => $this->channels,
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/ReminderRuleController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReminderRulesRequest;
use App\Http\Resources\ReminderRuleResource;
use App\Services\ReminderRuleSync;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ReminderRuleController extends Controller
{
    public function showDefaults(Request $request): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($request->user()->defaultReminderRules()->orderBy('days_before')->get());
    }

    public function updateDefaults(ReminderRulesRequest $request, ReminderRuleSync $sync): AnonymousResourceCollection
    {
        return ReminderRuleResource::collection($sync->sync($request->user(), null, $request->validated('rules')));
    }

    public function showForSubscription(Request $request, int $subscription): AnonymousResourceCollection
    {
        $rules = $request->user()->subscriptions()->findOrFail($subscription)->reminderRules()->orderBy('days_before')->get();

        return ReminderRuleResource::collection($rules)->additional(['meta' => ['uses_defaults' => $rules->isEmpty()]]);
    }

    public function updateForSubscription(ReminderRulesRequest $request, ReminderRuleSync $sync, int $subscription): AnonymousResourceCollection
    {
        $model = $request->user()->subscriptions()->findOrFail($subscription);
        $rules = $sync->sync($request->user(), $model, $request->validated('rules'));

        return ReminderRuleResource::collection($rules)->additional(['meta' => ['uses_defaults' => $rules->isEmpty()]]);
    }
}
```

`backend/app/Http/Controllers/Api/V1/DeviceController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Platform;
use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class DeviceController extends Controller
{
    public function store(Request $request): Response
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[.+\]$/'],
            'platform' => ['required', Rule::enum(Platform::class)],
        ]);

        DeviceToken::updateOrCreate(
            ['token' => $data['token']],
            ['user_id' => $request->user()->id, 'platform' => $data['platform'], 'last_seen_at' => now()],
        );

        return response()->noContent();
    }

    public function destroy(Request $request, string $token): Response
    {
        $request->user()->deviceTokens()->where('token', $token)->delete();

        return response()->noContent();
    }
}
```

`backend/app/Http/Controllers/Api/V1/WebPushController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class WebPushController extends Controller
{
    public function store(Request $request): Response
    {
        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:500'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', Rule::in(['aesgcm', 'aes128gcm'])],
        ]);

        $request->user()->updatePushSubscription(
            $data['endpoint'], $data['keys']['p256dh'], $data['keys']['auth'], $data['content_encoding'] ?? 'aes128gcm',
        );

        return response()->noContent();
    }

    public function destroy(Request $request): Response
    {
        $request->validate(['endpoint' => ['required', 'url']]);
        $request->user()->deletePushSubscription($request->input('endpoint'));

        return response()->noContent();
    }
}
```

In `backend/routes/api.php`, add `use` lines for the three controllers and, inside the authenticated group:
```php
Route::get('reminder-defaults', [ReminderRuleController::class, 'showDefaults']);
Route::put('reminder-defaults', [ReminderRuleController::class, 'updateDefaults']);
Route::get('subscriptions/{subscription}/reminders', [ReminderRuleController::class, 'showForSubscription'])->whereNumber('subscription');
Route::put('subscriptions/{subscription}/reminders', [ReminderRuleController::class, 'updateForSubscription'])->whereNumber('subscription');

Route::post('devices', [DeviceController::class, 'store']);
Route::delete('devices/{token}', [DeviceController::class, 'destroy'])->where('token', '.*');
Route::post('webpush/subscribe', [WebPushController::class, 'store']);
Route::delete('webpush/subscribe', [WebPushController::class, 'destroy']);
```

- [ ] **Step 5: Migrate and run all tests**

Run: `docker compose exec php php artisan migrate && docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat: add reminder rule, device token and web push subscription APIs"
```

---

### Task 11: PaymentReminder notification and Expo channel

**Files:**
- Create: `backend/app/Notifications/PaymentReminder.php`, `backend/app/Notifications/Channels/ExpoChannel.php`, `backend/app/Notifications/Channels/ExpoMessage.php`, `backend/lang/en/notifications.php`
- Modify: `backend/config/services.php`
- Test: `backend/tests/Feature/Notifications/PaymentReminderTest.php`

**Interfaces:**
- Consumes: `ReminderRule::hasChannel`, `CurrencyConverter::decimals`, `User::deviceTokens/pushSubscriptions/hasVerifiedEmail`.
- Produces:
  - `new PaymentReminder(Subscription $subscription, ReminderRule $rule, CarbonImmutable $paymentDate)` with the public properties `$subscription`, `$rule`, `$paymentDate`
  - The database payload `{subscription_id, payment_date, days_before, title, body}` (used by the inbox in Task 13)
  - Push payload data `{subscription_id, url: "/subscriptions/{id}"}` (used by the app for deep links)

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Notifications/PaymentReminderTest.php`:
```php
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Notifications/PaymentReminderTest.php`
Expected: FAIL — `Class "App\Notifications\PaymentReminder" not found`.

- [ ] **Step 3: Implement**

In `backend/config/services.php`, add:
```php
'expo' => [
    'access_token' => env('EXPO_ACCESS_TOKEN'),
],
```

`backend/lang/en/notifications.php`:
```php
<?php

return [
    'reminder' => [
        'title' => '{0} :service renews today|{1} :service renews tomorrow|[2,*] :service renews in :days days',
        'body' => ':amount on :date',
        'mail_subject' => ':service payment reminder',
        'mail_line' => 'Your :service subscription renews on :date for :amount.',
        'mail_action' => 'View subscription',
    ],
];
```

`backend/app/Notifications/Channels/ExpoMessage.php`:
```php
<?php

namespace App\Notifications\Channels;

final readonly class ExpoMessage
{
    public function __construct(public string $title, public string $body, public array $data = []) {}

    public function toArray(): array
    {
        return ['title' => $this->title, 'body' => $this->body, 'data' => $this->data, 'sound' => 'default', 'priority' => 'high'];
    }
}
```

`backend/app/Notifications/Channels/ExpoChannel.php`:
```php
<?php

namespace App\Notifications\Channels;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;

final class ExpoChannel
{
    public const URL = 'https://exp.host/--/api/v2/push/send';

    public function send(User $notifiable, Notification $notification): void
    {
        $tokens = $notifiable->deviceTokens()->pluck('token')->all();
        if ($tokens === []) {
            return;
        }

        /** @var ExpoMessage $message */
        $message = $notification->toExpo($notifiable);

        foreach (array_chunk($tokens, 100) as $chunk) {
            $tickets = Http::acceptJson()
                ->when(config('services.expo.access_token'), fn ($http, $token) => $http->withToken($token))
                ->timeout(15)
                ->post(self::URL, array_map(fn (string $to) => [...$message->toArray(), 'to' => $to], $chunk))
                ->throw()
                ->json('data', []);

            foreach ($tickets as $i => $ticket) {
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered') {
                    DeviceToken::where('token', $chunk[$i])->delete();
                }
            }
        }
    }
}
```

`backend/app/Notifications/PaymentReminder.php`:
```php
<?php

namespace App\Notifications;

use App\Enums\Channel;
use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\Channels\ExpoChannel;
use App\Notifications\Channels\ExpoMessage;
use App\Services\CurrencyConverter;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Number;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class PaymentReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public bool $deleteWhenMissingModels = true;

    public function __construct(
        public Subscription $subscription,
        public ReminderRule $rule,
        public CarbonImmutable $paymentDate,
    ) {}

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function via(User $notifiable): array
    {
        $channels = [];

        if ($this->rule->hasChannel(Channel::Push)) {
            if ($notifiable->deviceTokens()->exists()) {
                $channels[] = ExpoChannel::class;
            }
            if ($notifiable->pushSubscriptions()->exists()) {
                $channels[] = WebPushChannel::class;
            }
        }
        if ($this->rule->hasChannel(Channel::InApp)) {
            $channels[] = 'database';
        }
        if ($this->rule->hasChannel(Channel::Email) && $notifiable->hasVerifiedEmail()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toArray(User $notifiable): array
    {
        return [
            'subscription_id' => $this->subscription->id,
            'payment_date' => $this->paymentDate->toDateString(),
            'days_before' => $this->rule->days_before,
            'title' => $this->title(),
            'body' => $this->body(),
        ];
    }

    public function toExpo(User $notifiable): ExpoMessage
    {
        return new ExpoMessage($this->title(), $this->body(), $this->pushData());
    }

    public function toWebPush(User $notifiable, Notification $notification): WebPushMessage
    {
        return (new WebPushMessage)->title($this->title())->body($this->body())->data($this->pushData());
    }

    public function toMail(User $notifiable): MailMessage
    {
        $replace = ['service' => $this->serviceName(), 'date' => $this->date(), 'amount' => $this->amount()];

        return (new MailMessage)
            ->subject(__('notifications.reminder.mail_subject', $replace))
            ->line(__('notifications.reminder.mail_line', $replace))
            ->action(__('notifications.reminder.mail_action'), config('subs.frontend_url').$this->pushData()['url']);
    }

    private function title(): string
    {
        return trans_choice('notifications.reminder.title', $this->rule->days_before, [
            'service' => $this->serviceName(),
            'days' => $this->rule->days_before,
        ]);
    }

    private function body(): string
    {
        return __('notifications.reminder.body', ['amount' => $this->amount(), 'date' => $this->date()]);
    }

    private function serviceName(): string
    {
        return $this->subscription->service->name;
    }

    private function amount(): string
    {
        $currency = $this->subscription->currency;

        return Number::currency(
            $this->subscription->amount / 10 ** CurrencyConverter::decimals($currency),
            in: $currency,
            locale: app()->getLocale(),
        );
    }

    private function date(): string
    {
        return $this->paymentDate->locale(app()->getLocale())->isoFormat('LL');
    }

    private function pushData(): array
    {
        return ['subscription_id' => $this->subscription->id, 'url' => '/subscriptions/'.$this->subscription->id];
    }
}
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass. If the JPY assertion fails because ICU outputs a different yen sign (`￥`), change only the test's expected prefix to whatever `Number::currency(1600, in: 'JPY', locale: 'en')` returns in the container.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add multi-channel payment reminder notification with Expo push"
```

---

### Task 12: `reminders:dispatch` pipeline, Horizon, scheduler and health check

**Files:**
- Create: `backend/app/Console/Commands/DispatchReminders.php`
- Modify: `backend/routes/console.php`, `backend/app/Providers/AppServiceProvider.php`, `docker-compose.yml`
- Test: `backend/tests/Feature/Reminders/DispatchRemindersTest.php`

**Interfaces:**
- Consumes: `Subscription::effectiveReminderRules/isOccurrence`, `User::today`, `BillingCycle`, `SentReminder`, `PaymentReminder` (Task 11), `ReminderRuleSync` behaviour (Task 10).
- Produces: Artisan `reminders:dispatch`; the cache key `DispatchReminders::HEARTBEAT_KEY`; `/up` returns 500 when the heartbeat is missing or older than 30 min.

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Reminders/DispatchRemindersTest.php`:
```php
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Reminders/DispatchRemindersTest.php`
Expected: FAIL — `Command "reminders:dispatch" is not defined`.

- [ ] **Step 3: Implement**

`backend/app/Console/Commands/DispatchReminders.php`:
```php
<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\ReminderRule;
use App\Models\SentReminder;
use App\Models\Subscription;
use App\Notifications\PaymentReminder;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class DispatchReminders extends Command
{
    public const HEARTBEAT_KEY = 'reminders:heartbeat';

    protected $signature = 'reminders:dispatch';

    protected $description = 'Advance payment dates and queue payment reminders that are due';

    public function handle(): int
    {
        $now = CarbonImmutable::now();
        $queued = 0;

        Subscription::query()
            ->where('status', SubscriptionStatus::Active)
            ->with(['user.defaultReminderRules', 'reminderRules', 'service'])
            ->chunkById(500, function (Collection $subscriptions) use ($now, &$queued) {
                foreach ($subscriptions as $subscription) {
                    $this->advance($subscription);

                    foreach ($subscription->effectiveReminderRules() as $rule) {
                        $queued += $this->remind($subscription, $rule, $now);
                    }
                }
            });

        Cache::forever(self::HEARTBEAT_KEY, $now->getTimestamp());
        $this->info("Queued {$queued} reminder(s).");

        return self::SUCCESS;
    }

    private function advance(Subscription $subscription): void
    {
        $today = $subscription->user->today();

        if ($subscription->next_payment_date->lt($today)) {
            $subscription->next_payment_date = BillingCycle::nextOnOrAfter(
                $subscription->first_payment_date, $subscription->period, $subscription->interval_count, $today,
            );
            $subscription->save();
        }
    }

    /**
     * A reminder is due when (payment date − days_before) at time_of_day, in the user's
     * timezone, lies in (now − 24h, now]. Such a moment falls on the user's local today
     * or yesterday, so only two candidate payment dates need checking.
     */
    private function remind(Subscription $subscription, ReminderRule $rule, CarbonImmutable $now): int
    {
        $user = $subscription->user;
        $today = $user->today();
        $queued = 0;

        foreach ([$today, $today->subDay()] as $momentDate) {
            $paymentDate = $momentDate->addDays($rule->days_before);

            if ($paymentDate->lt($today) || ! $subscription->isOccurrence($paymentDate)) {
                continue;
            }

            $moment = CarbonImmutable::parse($momentDate->toDateString().' '.$rule->time_of_day, $user->timezone);
            if ($moment->lte($now->subDay()) || $moment->gt($now)) {
                continue;
            }

            $inserted = SentReminder::query()->insertOrIgnore([
                'subscription_id' => $subscription->id,
                'reminder_rule_id' => $rule->id,
                'payment_date' => $paymentDate->toDateString(),
            ]);

            if ($inserted === 1) {
                $user->notify(new PaymentReminder($subscription, $rule, $paymentDate));
                $queued++;
            }
        }

        return $queued;
    }
}
```

`backend/routes/console.php` (replace the file's body after `<?php`):
```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('reminders:dispatch')->everyFifteenMinutes()->withoutOverlapping();

// The ECB publishes around 16:00 CET.
Schedule::command('rates:fetch')->dailyAt('16:30')->timezone('Europe/Berlin');
```

In `AppServiceProvider::boot()`, add:
```php
Event::listen(DiagnosingHealth::class, function () {
    $last = Cache::get(DispatchReminders::HEARTBEAT_KEY);

    if ($last === null || now()->getTimestamp() - $last > 30 * 60) {
        throw new RuntimeException('The reminder scheduler has not run in the last 30 minutes.');
    }
});
```
with imports `App\Console\Commands\DispatchReminders`, `Illuminate\Foundation\Events\DiagnosingHealth`, `Illuminate\Support\Facades\Cache`, `Illuminate\Support\Facades\Event`, `RuntimeException`.

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Add Horizon and the scheduler to the local stack**

```bash
docker compose exec php composer require laravel/horizon
docker compose exec php php artisan horizon:install
```

Append to `services:` in `docker-compose.yml`:
```yaml
  horizon:
    build: ./docker/php
    command: php artisan horizon
    volumes:
      - ./backend:/var/www/backend
    depends_on: [postgres, redis]

  scheduler:
    build: ./docker/php
    command: php artisan schedule:work
    volumes:
      - ./backend:/var/www/backend
    depends_on: [postgres, redis]
```

Run: `docker compose up -d && docker compose exec php php artisan reminders:dispatch && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/up`
Expected: `Queued 0 reminder(s).` then `200`. Horizon UI at http://localhost:8080/horizon loads.

- [ ] **Step 6: Commit**

```bash
git add backend docker-compose.yml
git commit -m "feat: add exactly-once reminder dispatch, Horizon, scheduler and health check"
```

---

### Task 13: In-app notifications inbox API

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/NotificationController.php`, `backend/app/Http/Resources/NotificationResource.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/NotificationInboxTest.php`

**Interfaces:**
- Consumes: the `PaymentReminder::toArray` payload (Task 11).
- Produces: `NotificationResource {id,title,body,subscription_id,payment_date,read_at,created_at}`; `GET /notifications` (paginated, 20 per page, newest first), `GET /notifications/unread-count` → `{count}`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.

- [ ] **Step 1: Write the failing test**

`backend/tests/Feature/Api/NotificationInboxTest.php`:
```php
<?php

use App\Models\User;
use App\Notifications\PaymentReminder;
use Illuminate\Support\Str;

function inboxItem(User $user, string $title, ?string $readAt = null, string $createdAt = '2026-10-31 10:00:00'): string
{
    $id = (string) Str::uuid();
    $user->notifications()->create([
        'id' => $id,
        'type' => PaymentReminder::class,
        'data' => ['subscription_id' => 1, 'payment_date' => '2026-11-05', 'days_before' => 1, 'title' => $title, 'body' => '€12.99'],
        'read_at' => $readAt,
        'created_at' => $createdAt,
    ]);

    return $id;
}

it('lists newest first with an unread count', function () {
    $me = actingAsUser();
    inboxItem($me, 'Older', createdAt: '2026-10-30 10:00:00');
    inboxItem($me, 'Newer', readAt: '2026-10-31 11:00:00');

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.0.title', 'Newer')
        ->assertJsonPath('data.1.title', 'Older')
        ->assertJsonPath('data.1.read_at', null)
        ->assertJsonStructure(['meta' => ['current_page', 'last_page']]);

    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 1]);
});

it('marks one or all as read', function () {
    $me = actingAsUser();
    $a = inboxItem($me, 'A');
    inboxItem($me, 'B');

    $this->postJson("/api/v1/notifications/{$a}/read")->assertNoContent();
    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 1]);

    $this->postJson('/api/v1/notifications/read-all')->assertNoContent();
    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 0]);
});

it('cannot read other users notifications', function () {
    actingAsUser();
    $foreign = inboxItem(User::factory()->create(), 'Secret');

    $this->postJson("/api/v1/notifications/{$foreign}/read")->assertNotFound();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/Api/NotificationInboxTest.php`
Expected: FAIL — 404.

- [ ] **Step 3: Implement**

`backend/app/Http/Resources/NotificationResource.php`:
```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Illuminate\Notifications\DatabaseNotification */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->data['title'] ?? '',
            'body' => $this->data['body'] ?? '',
            'subscription_id' => $this->data['subscription_id'] ?? null,
            'payment_date' => $this->data['payment_date'] ?? null,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
```

`backend/app/Http/Controllers/Api/V1/NotificationController.php`:
```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return NotificationResource::collection($request->user()->notifications()->paginate(20));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $request->user()->unreadNotifications()->count()]);
    }

    public function read(Request $request, string $id): Response
    {
        $request->user()->notifications()->findOrFail($id)->markAsRead();

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
```

In `backend/routes/api.php`, add `use App\Http\Controllers\Api\V1\NotificationController;` and, inside the authenticated group:
```php
Route::get('notifications', [NotificationController::class, 'index']);
Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
Route::post('notifications/{id}/read', [NotificationController::class, 'read'])->whereUuid('id');
```

- [ ] **Step 4: Run all tests**

Run: `docker compose exec php ./vendor/bin/pest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: add in-app notification inbox API"
```

---

### Task 14: Translation guard, Sentry and CI

**Files:**
- Create: `backend/tests/Feature/TranslationsTest.php`, `.github/workflows/backend.yml`, `README.md`
- Modify: `backend/bootstrap/app.php`, `backend/.env.example`

**Interfaces:**
- Consumes: `config('subs.locales')`, `backend/lang/`.
- Produces: CI that runs Pint and Pest on every push; a test that fails if any supported locale is missing a key that `en` has.

- [ ] **Step 1: Write the translation guard test**

`backend/tests/Feature/TranslationsTest.php`:
```php
<?php

use Illuminate\Support\Arr;

function langKeys(string $locale): array
{
    $keys = [];
    foreach (glob(lang_path("{$locale}/*.php")) as $file) {
        $group = basename($file, '.php');
        foreach (array_keys(Arr::dot(require $file)) as $key) {
            $keys[] = "{$group}.{$key}";
        }
    }
    sort($keys);

    return $keys;
}

it('has every English key in every supported locale', function (string $locale) {
    expect(array_values(array_diff(langKeys('en'), langKeys($locale))))->toBe([]);
})->with(fn () => config('subs.locales'));

it('has a label for every preset category', function () {
    foreach (array_keys(\Database\Seeders\CategorySeeder::CATEGORIES) as $key) {
        expect(__("categories.{$key}"))->not->toBe("categories.{$key}");
    }
});
```

- [ ] **Step 2: Run it**

Run: `docker compose exec php ./vendor/bin/pest tests/Feature/TranslationsTest.php`
Expected: PASS (it guards against missing keys when a language is added later).

- [ ] **Step 3: Optional Sentry**

```bash
docker compose exec php composer require sentry/sentry-laravel
```
In `bootstrap/app.php`, inside `->withExceptions(function (Exceptions $exceptions) { … })`, add:
```php
\Sentry\Laravel\Integration::handles($exceptions);
```
Add `SENTRY_LARAVEL_DSN=` (empty, so Sentry is disabled) to `backend/.env.example`.

- [ ] **Step 4: CI workflow**

`.github/workflows/backend.yml`:
```yaml
name: backend

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: subs
          POSTGRES_PASSWORD: secret
          POSTGRES_DB: subs_testing
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U subs"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.4"
          extensions: pdo_pgsql, intl, gmp, redis, bcmath
          coverage: none
      - run: composer install --no-interaction --prefer-dist
      - run: cp .env.example .env && php artisan key:generate
      - run: ./vendor/bin/pint --test
      - run: ./vendor/bin/pest
        env:
          DB_HOST: 127.0.0.1
```

- [ ] **Step 5: README**

`README.md`:
````markdown
# Subs

Subscription tracker — Laravel API (`backend/`) + Expo app (`app/`, see Plan 2).

## Local backend

```bash
docker compose up -d --build
docker compose exec php composer install
cp backend/.env.example backend/.env   # first time only
docker compose exec php php artisan key:generate
docker compose exec php php artisan webpush:vapid
docker compose exec php php artisan migrate --seed
docker compose exec php php artisan rates:fetch
```

- API: http://localhost:8080/api/v1 · Health: http://localhost:8080/up
- Mail: http://localhost:8025 · Queues: http://localhost:8080/horizon
- Demo login: `demo@subs.test` / `password`
- Tests: `docker compose exec php ./vendor/bin/pest`

## Adding a language

1. Copy `backend/lang/en/` to `backend/lang/<xx>/` and translate.
2. Add `<xx>` to `locales` in `backend/config/subs.php`.
3. Do the same in the app (`app/src/i18n/`).
````

- [ ] **Step 6: Run Pint and the full suite**

Run: `docker compose exec php ./vendor/bin/pint && docker compose exec php ./vendor/bin/pest`
Expected: Pint fixes formatting; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add .github README.md backend
git commit -m "chore: add translation guard, optional Sentry and backend CI"
```

---

### Task 15: Production deployment files (OVH)

**Files:**
- Create: `docker-compose.prod.yml`, `docker/caddy/Caddyfile`, `docker/bin/deploy.sh`, `docker/bin/backup.sh`, `docker/php/Dockerfile.prod`
- Modify: `README.md`

**Interfaces:**
- Consumes: the images and services from Tasks 1 and 12.
- Produces: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` serves `api.<domain>` (Laravel) and `app.<domain>` (static Expo web build from `app/dist`) over HTTPS.

- [ ] **Step 1: Production image**

`docker/php/Dockerfile.prod`:
```dockerfile
FROM php:8.4-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libicu-dev libgmp-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql intl gmp pcntl zip bcmath opcache \
    && pecl install redis && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/backend
COPY backend/ .
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
```

- [ ] **Step 2: Compose override and Caddy**

`docker-compose.prod.yml`:
```yaml
services:
  php: &app
    build: { context: ., dockerfile: docker/php/Dockerfile.prod }
    image: subs-php:prod
    # Named volume is filled from the image's public/ on first start, so nginx can serve static files.
    volumes: !override
      - public:/var/www/backend/public
    env_file: backend/.env
    restart: unless-stopped
  horizon:
    <<: *app
    command: php artisan horizon
  scheduler:
    <<: *app
    command: php artisan schedule:work
  nginx:
    ports: !reset []
    volumes: !reset
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - public:/var/www/backend/public:ro
    restart: unless-stopped
  postgres:
    ports: !reset []
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD}
    restart: unless-stopped
  redis:
    restart: unless-stopped
  mailpit:
    profiles: [dev]
  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443"]
    environment:
      API_DOMAIN: ${API_DOMAIN:?set API_DOMAIN}
      APP_DOMAIN: ${APP_DOMAIN:?set APP_DOMAIN}
    volumes:
      - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./app/dist:/srv/app:ro
      - caddy_data:/data
    depends_on: [nginx]
    restart: unless-stopped

volumes:
  caddy_data:
  public:
```

`docker/caddy/Caddyfile`:
```caddy
{$API_DOMAIN} {
    encode gzip
    reverse_proxy nginx:80
}

{$APP_DOMAIN} {
    encode gzip
    root * /srv/app
    try_files {path} {path}.html /index.html
    file_server
}
```

- [ ] **Step 3: Deploy and backup scripts**

`docker/bin/deploy.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

git pull --ff-only
$COMPOSE build php
docker volume rm "$(basename "$PWD")_public" 2>/dev/null || true
$COMPOSE up -d
$COMPOSE exec -T php php artisan migrate --force
$COMPOSE exec -T php php artisan optimize
$COMPOSE exec -T php php artisan horizon:terminate
$COMPOSE exec -T php php artisan reminders:dispatch   # writes the first heartbeat for /up
```
(Removing the `public` volume lets it refill from the new image. If Docker refuses because a container still uses it, run `$COMPOSE down` before `up -d` instead.)

`docker/bin/backup.sh`:
```bash
#!/usr/bin/env bash
# Nightly: dump Postgres and upload to OVH Object Storage (S3-compatible, configured via `aws configure`).
set -euo pipefail
cd "$(dirname "$0")/../.."

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/subs-${STAMP}.sql.gz"

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U subs subs | gzip > "$FILE"
aws s3 cp "$FILE" "s3://${BACKUP_BUCKET:?set BACKUP_BUCKET}/postgres/" --endpoint-url "${BACKUP_ENDPOINT:?set BACKUP_ENDPOINT}"
rm -f "$FILE"
```

```bash
chmod +x docker/bin/deploy.sh docker/bin/backup.sh
```

- [ ] **Step 4: Validate the config**

Run: `API_DOMAIN=api.example.com APP_DOMAIN=app.example.com POSTGRES_PASSWORD=x docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet && echo OK`
Expected: `OK` (needs Docker Compose ≥ 2.24 for `!reset`/`!override`).

Run: `docker build -f docker/php/Dockerfile.prod -t subs-php:prod . && docker run --rm subs-php:prod php artisan --version`
Expected: `Laravel Framework 12.x`.

- [ ] **Step 5: Document**

Append to `README.md`:
````markdown
## Production (OVH)

On the server, one time:
1. Point DNS for `api.<domain>` and `app.<domain>` at the server.
2. Clone the repo and create `backend/.env` from `.env.example`:
   - `APP_ENV=production`, `APP_DEBUG=false`
   - `APP_URL=https://api.<domain>`, `FRONTEND_URL=https://app.<domain>`
   - a strong `DB_PASSWORD`, plus Postmark/SES `MAIL_*`
   - VAPID keys and `EXPO_ACCESS_TOKEN`
3. Export `API_DOMAIN`, `APP_DOMAIN` and `POSTGRES_PASSWORD` (same value as `DB_PASSWORD`).
4. Run `./docker/bin/deploy.sh`.
5. Cron: `0 3 * * * BACKUP_BUCKET=… BACKUP_ENDPOINT=https://s3.<region>.io.cloud.ovh.net /path/to/subs/docker/bin/backup.sh`

To deploy updates, run `./docker/bin/deploy.sh` again. The web app is built into `app/dist` (Plan 2) and served by Caddy.
````

- [ ] **Step 6: Commit**

```bash
git add docker docker-compose.prod.yml README.md
git commit -m "chore: add production compose, Caddy, deploy and backup scripts"
```

---

## Self-review notes

- **Spec coverage:**
  - §1 scope / free limit: Tasks 3 and 8
  - §2 architecture: Tasks 1 and 12
  - §3 data model and rules: Task 3; category deletion: Task 7
  - §4 billing cycle: Tasks 2 and 3
  - §5 API: Tasks 6–10 and 13; rate limits: Task 6
  - §6 dashboard and rates: Tasks 4, 5 and 9
  - §7 reminder pipeline, cleanup and heartbeat: Tasks 11 and 12 (Web Push cleanup on 404/410 is built into the webpush package)
  - §8 app: Plan 2
  - §9 seeds: Task 3
  - §10 tests and CI: in every task, plus Task 14
  - §11 local dev: Tasks 1 and 12
  - §12 deployment: Task 15
- **Left for Plan 2:** the Expo app, the `app/dist` web build, the app's CI job, and the app's i18n files.
