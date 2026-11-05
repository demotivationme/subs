# Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Subs to the OVH server that already runs musiband: images built in CI, released from `main` with a health check and rollback, served on its own port `8443` behind Cloudflare, with nightly encrypted backups.

**Architecture:** Four images (`subs-api`, `subs-nginx`, `subs-edge`, `subs-backup`) built by GitHub Actions and pushed to GHCR, tagged by git tree hash. A push to `main` copies `compose.prod.yaml` and the scripts to `/srv/subs` and runs `deploy.sh <tag>` over SSH. Caddy in `subs-edge` is the only published port (`8443:443`) and serves `api.unsab.com`, `admin.unsab.com` and `unsab.com` with the Cloudflare Origin Certificate. Musiband (`/srv/musiband`, ports 80/443) is the reference implementation and is never touched except one firewall line.

**Tech Stack:** Docker Compose, Caddy 2, nginx, PHP 8.5-fpm (Laravel 12, Horizon), Postgres 18, Redis 8, age + rclone (backups), GitHub Actions, bash + shellcheck, Pest.

**Spec:** `docs/superpowers/specs/2026-11-05-production-deploy-design.md`

## Global Constraints

- Only port published by Subs on the server: `8443` (container port 443 of `edge`). Nothing else gets `ports:`.
- Compose project name `subs`; network `internal` on subnet `172.31.0.0/24`.
- Images: `ghcr.io/demotivationme/subs-api`, `subs-nginx`, `subs-edge`, `subs-backup`; tags `tree-<git tree hash>` and the commit SHA.
- Host names: `api.unsab.com`, `admin.unsab.com`, `unsab.com`, `www.unsab.com` (301 to `unsab.com`). `media.unsab.com` is R2, not ours.
- `/api/admin/*` and `/horizon*` answer 404 on `api.unsab.com`; `/horizon*` is served only on `admin.unsab.com`.
- Backups: `age`-encrypted `pg_dump -Fc` to R2 bucket `unsab-backup`, prefixes `daily/` `weekly/` `monthly/`, keep 14 / 8 / 6, 3 local; cron `0 3 * * *` UTC; file names `subs-YYYYMMDDTHHMMSSZ.dump.age`.
- The app containers never get `.env.backup`; the backup container never gets `.env`.
- `deploy.sh` never runs `docker compose down` and never passes `-v`.
- Secrets are written by the user into `/srv/subs/.env`, `/srv/subs/.env.backup` and GitHub secrets; the repo only holds `*.example` files with empty values.
- Commit on `dev` only; never push. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't commit `docker-compose.override.yml`.
- Shell scripts start with `set -euo pipefail` (or `-Eeuo`) and pass `shellcheck`.

## Rulings (where the spec left a choice)

- **Laravel caches** are built by each container's entrypoint (`config:cache`, `route:cache`, `event:cache`), not by `php artisan optimize` in `deploy.sh`: every container has its own `bootstrap/cache`, so an `optimize` run in `app` would not reach `queue` or `scheduler`.
- **Horizon gate** trusts the `Cf-Access-Authenticated-User-Email` header, but only on the `ADMIN_DOMAIN` host and only for an email in `ADMIN_EMAILS`. Three things keep it honest: the firewall (only Cloudflare reaches 8443), Cloudflare Access on `admin.unsab.com` (Cloudflare sets that header), and Caddy answering 404 for `/horizon*` on every other host. Verifying the Access JWT itself belongs to the admin-panel spec.
- **Trusted proxies** move from `bootstrap/app.php` to `AppServiceProvider::boot()` (`TrustProxies::at(config('subs.trusted_proxies'))`) so they come from config; the default stays the private ranges for local Docker.
- **`backups:check`** is scheduled only in `production` (no backup runs locally, so it would log an error every hour).
- **Cloudflare IP list:** the edge mounts `${CLOUDFLARE_IPS_DIR:-/srv/musiband/caddy}` read-only and imports `cloudflare-ips.caddy` from it (musiband's monthly cron keeps it current).
- **Rollback input** is a full commit SHA (as musiband's), not "the previous tag read from the server": the workflow can verify a SHA's images before touching the server, and `deploy.sh` already returns to the previous tag by itself when a release is unhealthy.
- **musiband firewall edit** is committed only on a new local branch `subs-port-8443` in `/Users/demo/Sites/musiband`, never pushed; the user releases it.

## Review Focus

- A request to `admin.unsab.com/horizon` without the Access header, or `api.unsab.com/horizon` with a forged one, must be refused (403 from Laravel, 404 from Caddy) — tests in Task 1 and Task 3.
- `ADMIN_EMAILS=" Me@Example.com , "` must allow `me@example.com` (trimmed, lowercased, blanks dropped) — test in Task 1.
- The first deploy on an empty database: `/up` fails until `reminders:dispatch` has written its heartbeat, so `deploy.sh` must run it before the health check — test in Task 6.
- A tag argument with shell metacharacters (`deploy.sh 'x;rm -rf /'`) must be rejected before anything runs — test in Task 6.
- `backups:check` before the first backup ever ran (no status file, broken JSON) must log "No database backup has succeeded yet", not crash — test in Task 1.

---

### Task 1: Backend production settings — admin gate, trusted proxies, backup check

**Files:**
- Modify: `backend/config/subs.php`
- Create: `backend/app/Http/AdminAccess.php`
- Modify: `backend/app/Providers/HorizonServiceProvider.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`
- Modify: `backend/bootstrap/app.php`
- Create: `backend/app/Console/Commands/CheckBackups.php`
- Modify: `backend/routes/console.php`
- Modify: `backend/.env.example`
- Test: `backend/tests/Feature/AdminAccessTest.php`, `backend/tests/Feature/TrustedProxiesTest.php`, `backend/tests/Feature/Commands/CheckBackupsTest.php`

**Interfaces:**
- Produces: config keys `subs.admin_domain` (string), `subs.admin_emails` (list of lowercase strings), `subs.trusted_proxies` (list of CIDR strings), `subs.backup_status_file` (absolute path); `App\Http\AdminAccess::allows(Request): bool`; constant `AdminAccess::EMAIL_HEADER = 'Cf-Access-Authenticated-User-Email'`; Artisan command `backups:check`. Env keys `ADMIN_DOMAIN`, `ADMIN_EMAILS`, `TRUSTED_PROXIES`, `BACKUP_STATUS_FILE` (Task 5 lists them in `.env.production.example`).
- Consumes: the backup container writes `status.json` with keys `last_run_at`, `last_run_ok`, `last_success_at`, `object`, `size_bytes`, `error` into `storage/app/private/backups/` (Task 4, mounted in Task 5).

- [ ] **Step 1: Write the failing tests**

`backend/tests/Feature/AdminAccessTest.php`:

```php
<?php

use App\Http\AdminAccess;

beforeEach(fn () => config(['subs.admin_domain' => 'admin.unsab.com', 'subs.admin_emails' => ['me@example.com']]));

it('opens Horizon on the admin host for an allowed Access email', function () {
    $this->get('http://admin.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'me@example.com'])->assertOk();
});

it('refuses Horizon without the Access header, for another email, or on another host', function (string $url, array $headers) {
    $this->get($url, $headers)->assertForbidden();
})->with([
    'no header' => ['http://admin.unsab.com/horizon', []],
    'other email' => ['http://admin.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'someone@example.com']],
    'api host' => ['http://api.unsab.com/horizon', [AdminAccess::EMAIL_HEADER => 'me@example.com']],
]);

it('normalises ADMIN_EMAILS: trimmed, lowercased, blanks dropped', function () {
    putenv('ADMIN_EMAILS= Me@Example.com , ,Other@X.io');
    $config = require config_path('subs.php');
    putenv('ADMIN_EMAILS');

    expect($config['admin_emails'])->toBe(['me@example.com', 'other@x.io']);
});
```

`backend/tests/Feature/TrustedProxiesTest.php`:

```php
<?php

use App\Providers\AppServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(fn () => Route::get('/_client-ip', fn (Request $request) => $request->ip()));

it('trusts the private Docker ranges by default', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '172.31.0.5'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('203.0.113.9');
});

it('trusts only the configured proxies', function () {
    config(['subs.trusted_proxies' => ['172.31.0.0/24']]);
    app()->getProvider(AppServiceProvider::class)->boot();

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.7'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('10.0.0.7');
    $this->withServerVariables(['REMOTE_ADDR' => '172.31.0.5'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('203.0.113.9');
});
```

`backend/tests/Feature/Commands/CheckBackupsTest.php`:

```php
<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Carbon::setTestNow('2026-11-05 12:00:00');
    $this->file = sys_get_temp_dir().'/subs-status-'.bin2hex(random_bytes(4)).'.json';
    config(['subs.backup_status_file' => $this->file]);
    $this->status = fn (array $values) => file_put_contents($this->file, json_encode(array_merge([
        'last_run_at' => '2026-11-05T03:00:12Z', 'last_run_ok' => true, 'last_success_at' => '2026-11-05T03:00:12Z',
        'object' => 'daily/subs-20261105T030001Z.dump.age', 'size_bytes' => 4096, 'error' => null,
    ], $values)));
});

afterEach(fn () => @unlink($this->file));

it('stays quiet when the backup is fresh', function () {
    ($this->status)([]);
    Log::shouldReceive('error')->never();

    $this->artisan('backups:check')->assertSuccessful();
});

it('logs an error when the last success is older than 26 hours', function () {
    ($this->status)(['last_run_at' => '2026-11-04T09:00:00Z', 'last_success_at' => '2026-11-04T09:00:00Z']);
    Log::shouldReceive('error')->once()->withArgs(fn (string $message) => $message === 'Backup is stale');

    $this->artisan('backups:check')->assertSuccessful();
});

it('logs an error when the last run failed', function () {
    ($this->status)(['last_run_ok' => false, 'error' => 'upload: access denied']);
    Log::shouldReceive('error')->once()
        ->withArgs(fn (string $message, array $context) => $message === 'Last backup run failed' && $context['error'] === 'upload: access denied');

    $this->artisan('backups:check')->assertSuccessful();
});

it('logs an error when no backup has succeeded yet', function (?string $contents) {
    if ($contents !== null) {
        file_put_contents($this->file, $contents);
    }
    Log::shouldReceive('error')->once()->withArgs(fn (string $message) => $message === 'No database backup has succeeded yet');

    $this->artisan('backups:check')->assertSuccessful();
})->with(['missing file' => null, 'broken json' => '{not json', 'empty object' => '{}']);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `docker compose exec -T php php artisan test --compact --filter='AdminAccessTest|TrustedProxiesTest|CheckBackupsTest'`
Expected: FAIL — `Class "App\Http\AdminAccess" not found`, `Command "backups:check" is not defined`, and the "trusts only the configured proxies" case sees `203.0.113.9` from `10.0.0.7`.

- [ ] **Step 3: Add the config keys**

In `backend/config/subs.php`, after `'logo_disk' => …,` add:

```php
    // admin.unsab.com sits behind Cloudflare Access, which sets Cf-Access-Authenticated-User-Email.
    'admin_domain' => env('ADMIN_DOMAIN', 'admin.unsab.com'),
    'admin_emails' => array_values(array_filter(array_map(
        fn (string $email) => strtolower(trim($email)),
        explode(',', (string) env('ADMIN_EMAILS', '')),
    ))),

    // Proxies whose X-Forwarded-* Laravel believes. Production: only the Subs Docker network.
    'trusted_proxies' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('TRUSTED_PROXIES', '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')),
    ))),

    // Written by the backup container (deploy/backup/backup.sh) through a shared mount.
    'backup_status_file' => env('BACKUP_STATUS_FILE', storage_path('app/private/backups/status.json')),
```

- [ ] **Step 4: Add `AdminAccess` and use it for Horizon**

`backend/app/Http/AdminAccess.php`:

```php
<?php

namespace App\Http;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Who may open admin tools (Horizon now, the admin panel later): an ADMIN_EMAILS address that Cloudflare Access
 * vouched for, on the admin host only. Caddy refuses those paths on every other host.
 */
final class AdminAccess
{
    public const EMAIL_HEADER = 'Cf-Access-Authenticated-User-Email';

    public static function allows(Request $request): bool
    {
        if ($request->getHost() !== config('subs.admin_domain')) {
            return false;
        }

        $email = Str::lower(trim((string) $request->header(self::EMAIL_HEADER)));

        return $email !== '' && in_array($email, config('subs.admin_emails'), true);
    }
}
```

In `backend/app/Providers/HorizonServiceProvider.php` replace the `gate()` body:

```php
    protected function gate(): void
    {
        Gate::define('viewHorizon', fn ($user = null) => AdminAccess::allows(request()));
    }
```

and add `use App\Http\AdminAccess;` to its imports.

- [ ] **Step 5: Move trusted proxies into config**

In `backend/bootstrap/app.php` delete these three lines:

```php
        // Caddy reaches nginx/php over the Docker network: trust its X-Forwarded-* so the
        // client IP (auth limiter) and https scheme (signed verification links) are real.
        $middleware->trustProxies(at: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']);
```

In `backend/app/Providers/AppServiceProvider.php` add `use Illuminate\Http\Middleware\TrustProxies;` and make this the first statement of `boot()`:

```php
        // Caddy reaches nginx/php over the Docker network: trust its X-Forwarded-* so the
        // client IP (auth limiter) and https scheme (signed verification links) are real.
        TrustProxies::at(config('subs.trusted_proxies'));
```

- [ ] **Step 6: Add `backups:check`**

`backend/app/Console/Commands/CheckBackups.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

final class CheckBackups extends Command
{
    protected $signature = 'backups:check';

    protected $description = 'Log an error when the last database backup is missing, failed or older than 26 hours';

    public function handle(): int
    {
        $file = config('subs.backup_status_file');
        $status = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        if (! is_array($status) || empty($status['last_success_at'])) {
            Log::error('No database backup has succeeded yet');

            return self::SUCCESS;
        }

        if (($status['last_run_ok'] ?? false) !== true) {
            Log::error('Last backup run failed', ['error' => $status['error'] ?? null]);
        }

        if (Carbon::parse($status['last_success_at'])->lt(now()->subHours(26))) {
            Log::error('Backup is stale', ['last_success_at' => $status['last_success_at']]);
        }

        return self::SUCCESS;
    }
}
```

Append to `backend/routes/console.php`:

```php

// Backups only run on the server (the backup container, 03:00 UTC).
Schedule::command('backups:check')->hourlyAt(5)->environments(['production']);
```

- [ ] **Step 7: Update `.env.example`**

In `backend/.env.example` replace the five `R2_*` lines with the keys the R2 disk reads now, and add the new ones:

```
MEDIA_S3_KEY=
MEDIA_S3_SECRET=
MEDIA_S3_REGION=auto
MEDIA_S3_BUCKET=
MEDIA_S3_ENDPOINT=
MEDIA_S3_PATH_STYLE=false
MEDIA_URL=

# Production: admin.unsab.com behind Cloudflare Access; comma-separated emails that may open Horizon.
ADMIN_DOMAIN=admin.unsab.com
ADMIN_EMAILS=
# Production sets the Subs Docker network. Left commented, the default trusts the private ranges
# (an empty value would trust nothing).
# TRUSTED_PROXIES=172.31.0.0/24
```

- [ ] **Step 8: Run the tests and the suite**

Run: `docker compose exec -T php php artisan test --compact`
Expected: PASS, every test (215 before this task plus the new ones).
Run: `docker compose exec -T php ./vendor/bin/pint --test`
Expected: no changes needed.

- [ ] **Step 9: Commit**

```bash
git add backend/config/subs.php backend/app/Http/AdminAccess.php backend/app/Providers backend/bootstrap/app.php \
  backend/app/Console/Commands/CheckBackups.php backend/routes/console.php backend/.env.example \
  backend/tests/Feature/AdminAccessTest.php backend/tests/Feature/TrustedProxiesTest.php backend/tests/Feature/Commands/CheckBackupsTest.php
git commit -m "feat(backend): admin gate via Cloudflare Access, configurable trusted proxies, backups:check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API and nginx production images

**Files:**
- Create: `docker/prod/api.Dockerfile`, `docker/prod/entrypoint.sh`, `docker/prod/nginx.conf`, `docker/prod/php.ini`, `docker/prod/php-fpm-pool.conf`
- Modify: `.dockerignore`

**Interfaces:**
- Produces: build targets `app` (→ `subs-api`) and `nginx` (→ `subs-nginx`) of `docker/prod/api.Dockerfile`, build context = repo root. Code lives at `/var/www/html`; `storage/` is a mount point. nginx listens on 80 and passes PHP to `app:9000`.

- [ ] **Step 1: Write the Dockerfile**

`docker/prod/api.Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM php:8.5-fpm-alpine AS base
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_pgsql redis intl zip bcmath pcntl gmp opcache
COPY docker/prod/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/prod/php-fpm-pool.conf /usr/local/etc/php-fpm.d/zz-subs.conf
ENV PHP_FPM_MAX_CHILDREN=20
WORKDIR /var/www/html

FROM base AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --no-autoloader --prefer-dist

FROM base AS app
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=vendor /var/www/html/vendor ./vendor
COPY backend/ ./
RUN composer dump-autoload --no-dev --classmap-authoritative --optimize \
    && php artisan package:discover --ansi \
    && rm /usr/local/bin/composer \
    && chown -R www-data:www-data storage bootstrap/cache
COPY --chmod=755 docker/prod/entrypoint.sh /usr/local/bin/entrypoint
USER www-data
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

FROM nginx:1-alpine AS nginx
COPY docker/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY backend/public /var/www/html/public
```

- [ ] **Step 2: Entrypoint and server configs**

`docker/prod/entrypoint.sh`:

```sh
#!/bin/sh
set -eu

# The storage mount starts empty on a new server.
mkdir -p storage/app/private/backups storage/app/public storage/framework/cache/data storage/framework/sessions \
  storage/framework/views storage/logs bootstrap/cache

# Each container has its own bootstrap/cache, so each long-running one builds its caches at start.
case "$*" in
  php-fpm*|"php artisan horizon"*|"php artisan schedule:work"*)
    php artisan config:cache
    php artisan route:cache
    php artisan event:cache
    ;;
esac

exec "$@"
```

`docker/prod/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html/public;
    index index.php;
    charset utf-8;
    client_max_body_size 16M;
    server_tokens off;
    # Re-resolve `app` (Docker DNS): a redeploy recreates the container with a new IP.
    resolver 127.0.0.11 valid=10s ipv6=off;
    set $php_upstream app:9000;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ ^/index\.php(/|$) {
        fastcgi_pass $php_upstream;
        fastcgi_param SCRIPT_FILENAME /var/www/html/public/index.php;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

`docker/prod/php.ini`:

```ini
expose_php = Off
memory_limit = 256M
upload_max_filesize = 16M
post_max_size = 16M
max_execution_time = 60
opcache.enable = 1
opcache.enable_cli = 1
opcache.memory_consumption = 128
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 0
realpath_cache_size = 4096K
realpath_cache_ttl = 600
; Errors go to the log, never to the visitor.
display_errors = Off
display_startup_errors = Off
log_errors = On
```

`docker/prod/php-fpm-pool.conf`:

```ini
; Production pool (overrides www.conf). Size PHP_FPM_MAX_CHILDREN to the RAM left for PHP ÷ about 60 MB.
[www]
pm = dynamic
pm.max_children = ${PHP_FPM_MAX_CHILDREN}
pm.start_servers = 4
pm.min_spare_servers = 2
pm.max_spare_servers = 8
pm.max_requests = 500
```

- [ ] **Step 3: `.dockerignore`**

Replace `.dockerignore` with (the old one excluded `docs/` and `app/` which stay excluded; `landing/`, `deploy/` and `docker/` must be in the context):

```
.git
.github
.idea
.superpowers
.DS_Store
app/
docs/
data/
backups/
docker-compose*.yml
**/node_modules
backend/vendor
backend/.env
backend/storage/logs/*
backend/storage/framework/cache/data/*
backend/storage/framework/sessions/*
backend/storage/framework/views/*
backend/storage/app/*
backend/.phpunit.result.cache
```

- [ ] **Step 4: Build both targets and smoke-test them**

Run:
```bash
docker build -q -f docker/prod/api.Dockerfile --target app -t subs-api:local .
docker build -q -f docker/prod/api.Dockerfile --target nginx -t subs-nginx:local .
docker run --rm subs-api:local php -r 'foreach (["pdo_pgsql","redis","intl","gmp","pcntl","bcmath","Zend OPcache"] as $e) echo $e, "=", extension_loaded($e) ? "yes" : "NO", PHP_EOL;'
docker run --rm -e APP_KEY=base64:$(openssl rand -base64 32) subs-api:local php artisan --version
docker run --rm subs-nginx:local nginx -t 2>&1 | tail -1
```
Expected: both builds print an image ID; all seven extensions print `=yes`; `Laravel Framework 12.…`; nginx prints `test is successful`. (`nginx -t` resolves `app` lazily via the variable, so it passes without the app container.)

- [ ] **Step 5: Commit**

```bash
git add docker/prod/api.Dockerfile docker/prod/entrypoint.sh docker/prod/nginx.conf docker/prod/php.ini docker/prod/php-fpm-pool.conf .dockerignore
git commit -m "build: production API and nginx images

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Edge image — Caddy, landing page, admin placeholder

**Files:**
- Create: `docker/prod/Caddyfile`, `docker/prod/edge.Dockerfile`, `docker/prod/admin/index.html`
- Create: `landing/index.html`
- Test: `deploy/tests/edge-test.sh`

**Interfaces:**
- Consumes: `nginx:80` on the compose network (Task 5); `/etc/caddy/certs/origin.pem` + `origin.key`; `/etc/caddy/extra/cloudflare-ips.caddy` (a `trusted_proxies static …` line).
- Produces: image `subs-edge` listening on container port 443.

- [ ] **Step 1: Write the failing edge test**

`deploy/tests/edge-test.sh`:

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the status of its own test on purpose
# Runs the edge image against a stub upstream named nginx and checks the routing per host name.
# Usage: bash deploy/tests/edge-test.sh   (needs docker and openssl)
set -uo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
net=subs-edge-test
failures=0
cleanup() { docker rm -f subs-edge-test-edge subs-edge-test-nginx > /dev/null 2>&1; docker network rm "$net" > /dev/null 2>&1; rm -rf "$work"; }
trap cleanup EXIT
check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1 ${3:-}"; failures=$((failures + 1)); fi; }

docker build -q -f "$repo/docker/prod/edge.Dockerfile" -t subs-edge:test "$repo" > /dev/null || { echo "FAIL  image build"; exit 1; }
mkdir -p "$work/certs" "$work/extra" "$work/stub"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=unsab.com" -addext "subjectAltName=DNS:unsab.com,DNS:*.unsab.com" \
  -keyout "$work/certs/origin.key" -out "$work/certs/origin.pem" 2> /dev/null
echo "trusted_proxies static private_ranges" > "$work/extra/cloudflare-ips.caddy"
docker network create "$net" > /dev/null
# Stub upstream: answers "proxied <path>" so a 404 from Caddy and a reply from nginx can be told apart.
printf ':80 {\n\trespond "proxied {path}"\n}\n' > "$work/stub/Caddyfile"
docker run -d --name subs-edge-test-nginx --network "$net" --network-alias nginx \
  -v "$work/stub/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine > /dev/null
docker run -d --name subs-edge-test-edge --network "$net" -p 127.0.0.1:18443:443 \
  -v "$work/certs:/etc/caddy/certs:ro" -v "$work/extra:/etc/caddy/extra:ro" subs-edge:test > /dev/null
for _ in $(seq 1 30); do curl -sk -o /dev/null --resolve unsab.com:18443:127.0.0.1 https://unsab.com:18443/ && break; sleep 1; done

req() { # req <host> <path> → "<status> <body>"
  curl -sk --resolve "$1:18443:127.0.0.1" -o "$work/body" -w '%{http_code}' "https://$1:18443$2"; printf ' '; head -c 200 "$work/body"
}

check "landing page" "$([[ $(req unsab.com /) == "200 "*Unsab* ]]; echo $?)" "($(req unsab.com /))"
check "www redirects" "$(curl -sk --resolve www.unsab.com:18443:127.0.0.1 -o /dev/null -w '%{http_code} %{redirect_url}' https://www.unsab.com:18443/x | grep -q '^301 https://unsab.com/x'; echo $?)"
check "api proxied" "$([[ $(req api.unsab.com /up) == "200 proxied /up" ]]; echo $?)" "($(req api.unsab.com /up))"
check "api hides horizon" "$([[ $(req api.unsab.com /horizon) == 404* ]]; echo $?)"
check "api hides horizon subpaths" "$([[ $(req api.unsab.com /horizon/api/stats) == 404* ]]; echo $?)"
check "api hides admin api" "$([[ $(req api.unsab.com /api/admin/v1/x) == 404* ]]; echo $?)"
check "admin proxies horizon" "$([[ $(req admin.unsab.com /horizon) == "200 proxied /horizon" ]]; echo $?)"
check "admin placeholder" "$([[ $(req admin.unsab.com /anything) == "200 "*"coming soon"* ]]; echo $?)"
check "admin frame header" "$(curl -sk -D - -o /dev/null --resolve admin.unsab.com:18443:127.0.0.1 https://admin.unsab.com:18443/ | grep -qi '^x-frame-options: DENY'; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash deploy/tests/edge-test.sh`
Expected: `FAIL  image build` (no `edge.Dockerfile` yet).

- [ ] **Step 3: Write the Caddyfile and edge Dockerfile**

`docker/prod/Caddyfile` (tabs for indentation, as Caddy formats it):

```caddyfile
{
	admin off
	auto_https disable_certs
	# Cloudflare always sends SNI; clients that send none still get the site's certificate.
	default_sni unsab.com
	servers {
		# musiband's cloudflare-ips.sh writes this: `trusted_proxies static <Cloudflare ranges>`.
		import /etc/caddy/extra/cloudflare-ips.caddy
		client_ip_headers CF-Connecting-IP
	}
	log {
		output stdout
		format json
	}
}

(tls_origin) {
	tls /etc/caddy/certs/origin.pem /etc/caddy/certs/origin.key
}

(forwarded) {
	# Only these forwarding headers reach Laravel; client-supplied Port/Prefix would change generated URLs.
	header_up -X-Forwarded-Port
	header_up -X-Forwarded-Prefix
	header_up X-Forwarded-For {client_ip}
	header_up X-Forwarded-Proto https
	header_up X-Forwarded-Host {host}
}

www.unsab.com {
	import tls_origin
	redir https://unsab.com{uri} permanent
}

unsab.com {
	import tls_origin
	encode zstd gzip
	root * /srv/landing
	file_server
	header {
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}
}

api.unsab.com {
	import tls_origin
	encode zstd gzip
	# Horizon and the admin API only answer on admin.unsab.com (behind Cloudflare Access).
	@private path /horizon /horizon/* /api/admin/*
	respond @private 404
	reverse_proxy nginx:80 {
		import forwarded
	}
}

admin.unsab.com {
	import tls_origin
	encode zstd gzip
	handle /horizon* {
		reverse_proxy nginx:80 {
			import forwarded
		}
	}
	handle {
		root * /srv/admin
		try_files {path} /index.html
		file_server
	}
	header {
		X-Frame-Options DENY
		X-Content-Type-Options nosniff
		Referrer-Policy same-origin
	}
}
```

`docker/prod/edge.Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM caddy:2-alpine
COPY docker/prod/Caddyfile /etc/caddy/Caddyfile
COPY landing/ /srv/landing/
COPY docker/prod/admin/ /srv/admin/
```

- [ ] **Step 4: Landing page and admin placeholder**

`landing/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsab — every subscription, one place</title>
<meta name="description" content="Unsab tracks your subscriptions, shows what they cost each month and reminds you before every payment.">
<style>
  :root { --bg: #F6F7F5; --ink: #12201A; --muted: #5B6B63; --brand: #0B7A57; --card: #FFFFFF; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0E1512; --ink: #E8EFEA; --muted: #9AABA2; --brand: #2FB383; --card: #16201B; color-scheme: dark; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 16px;
    background: var(--bg); color: var(--ink); font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 520px; text-align: center; }
  .mark { width: 96px; height: 96px; border-radius: 28px; background: #0B7A57; display: inline-grid; place-items: center; }
  h1 { font-size: clamp(32px, 6vw, 44px); margin: 24px 0 8px; letter-spacing: -0.02em; }
  p { color: var(--muted); margin: 0 0 32px; font-size: 18px; }
  .stores { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .store { background: var(--card); border: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); border-radius: 14px;
    padding: 12px 20px; min-width: 200px; text-align: left; }
  .store small { display: block; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
  .store strong { font-size: 17px; }
  footer { margin-top: 48px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
  <span class="mark" aria-hidden="true">
    <svg width="60" height="60" viewBox="0 -1.5 64 64" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M49.32 22A20 20 0 1 1 32 12"/><path d="M28 5.5L34.5 12L28 18.5"/><circle cx="32" cy="32" r="5"/>
    </svg>
  </span>
  <h1>Unsab</h1>
  <p>Every subscription in one place: what you pay each month, and a reminder before every renewal.</p>
  <div class="stores">
    <div class="store"><small>Coming soon</small><strong>App Store</strong></div>
    <div class="store"><small>Coming soon</small><strong>Google Play</strong></div>
  </div>
  <footer>© 2026 Unsab</footer>
</main>
</body>
</html>
```

`docker/prod/admin/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsab admin</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  a { color: #0B7A57; }
</style>
</head>
<body>
<main>
  <h1>Unsab admin</h1>
  <p>The admin panel is coming soon. Queue dashboard: <a href="/horizon">Horizon</a>.</p>
</main>
</body>
</html>
```

- [ ] **Step 5: Run the edge test**

Run: `bash deploy/tests/edge-test.sh`
Expected: nine `PASS` lines and `ALL PASS`.

- [ ] **Step 6: Commit**

```bash
git add docker/prod/Caddyfile docker/prod/edge.Dockerfile docker/prod/admin/index.html landing/index.html deploy/tests/edge-test.sh
git commit -m "build: edge image serving api, admin and the landing page on unsab.com

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Backup image, backup and restore scripts

**Files:**
- Create: `docker/prod/backup.Dockerfile`, `deploy/backup/backup.sh`, `deploy/backup/crontab`, `deploy/restore.sh`
- Test: `deploy/tests/backup-harness.sh`

**Interfaces:**
- Consumes: environment `DB_HOST DB_DATABASE DB_USERNAME DB_PASSWORD BACKUP_AGE_RECIPIENT BACKUP_S3_PROVIDER BACKUP_S3_ENDPOINT BACKUP_S3_REGION BACKUP_S3_BUCKET BACKUP_S3_KEY BACKUP_S3_SECRET` and optional `BACKUP_KEEP_DAILY/WEEKLY/MONTHLY/LOCAL`, `FAKE_NOW`; mounts `/backups` and `/status`.
- Produces: image `subs-backup` (default command `crond -f`); `/status/status.json` with keys `last_run_at last_run_ok last_success_at object size_bytes error` (read by `backups:check`, Task 1); `restore.sh <daily|weekly|monthly>/subs-…dump.age [--yes]` restoring into database `subs_restore`.

- [ ] **Step 1: Write the failing harness**

`deploy/tests/backup-harness.sh`:

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the exit status of its own test expression on purpose
# End-to-end test of the backup job and restore.sh: Postgres, an S3 server standing in for the bucket (`rclone serve s3`
# over a local folder, from the backup image itself) and a throwaway age key. Usage: bash deploy/tests/backup-harness.sh
set -uo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
net=subs-backup-test
pg=sbt-db
s3=sbt-s3
image=subs-backup:test
work="$(mktemp -d)"
failures=0

cleanup() {
  docker rm -f "$pg" "$s3" > /dev/null 2>&1
  docker network rm "$net" > /dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT

check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1 ${3:-}"; failures=$((failures + 1)); fi; }

bucket() { echo "$work/s3/backups/$1"; }
count() { find "$(bucket "$1")" -maxdepth 1 -name 'subs-*' 2> /dev/null | wc -l | tr -d ' '; }
has() { [[ -f "$(bucket "$1")/$2" ]]; }
put() { mkdir -p "$(bucket "$1")" && echo x > "$(bucket "$1")/$2"; }

run_backup() {
  docker run --rm --network "$net" \
    -e DB_HOST="$pg" -e DB_DATABASE=subs -e DB_USERNAME=subs -e DB_PASSWORD=secret \
    -e BACKUP_AGE_RECIPIENT="$recipient" \
    -e BACKUP_S3_PROVIDER=Other -e BACKUP_S3_ENDPOINT="http://$s3:9000" -e BACKUP_S3_REGION=us-east-1 \
    -e BACKUP_S3_BUCKET=backups -e BACKUP_S3_KEY=key -e BACKUP_S3_SECRET="${secret:-secret123}" \
    -v "$work/backups:/backups" -v "$work/status:/status" "$@" "$image" /usr/local/bin/backup.sh
}

status() { sed -n "s/.*\"$1\":\([^,}]*\).*/\1/p" "$work/status/status.json" | tr -d '"'; }

restore_args="--network $net -e DB_HOST=$pg -e DB_DATABASE=subs -e DB_USERNAME=subs -e DB_PASSWORD=secret -e BACKUP_S3_PROVIDER=Other -e BACKUP_S3_ENDPOINT=http://$s3:9000 -e BACKUP_S3_REGION=us-east-1 -e BACKUP_S3_BUCKET=backups -e BACKUP_S3_KEY=key -e BACKUP_S3_SECRET=secret123"

echo "== setup"
docker build -q -f "$repo/docker/prod/backup.Dockerfile" -t "$image" "$repo" > /dev/null || { echo "FAIL  image build"; exit 1; }
docker network create "$net" > /dev/null
docker run -d --name "$pg" --network "$net" -e POSTGRES_DB=subs -e POSTGRES_USER=subs -e POSTGRES_PASSWORD=secret postgres:18-alpine > /dev/null
mkdir -p "$work/s3/backups"
docker run -d --name "$s3" --network "$net" -v "$work/s3:/data" --entrypoint rclone "$image" serve s3 --auth-key key,secret123 --addr :9000 --dir-cache-time 0s /data > /dev/null
for _ in $(seq 1 30); do docker exec "$pg" pg_isready -U subs -d subs > /dev/null 2>&1 && break; sleep 1; done
sleep 3
docker exec "$pg" psql -U subs -d subs -qc "create table harness_rows(id int); insert into harness_rows values (1),(2),(3);"
mkdir -p "$work/backups" "$work/status" "$work/key"
docker run --rm -v "$work/key:/key" --entrypoint age-keygen "$image" -o /key/identity.txt 2> /dev/null
recipient="$(sed -n 's/^# public key: //p' "$work/key/identity.txt")"
[[ "$recipient" == age1* ]] || { echo "FAIL  age key"; exit 1; }

echo "== first backup"
run_backup > "$work/first.log" 2>&1; code=$?
check "exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/first.log" | tr '\n' ' '))"
check "one daily object" "$([[ $(count daily) == 1 ]]; echo $?)" "(found $(count daily))"
check "status ok" "$([[ $(status last_run_ok) == true ]]; echo $?)"
check "one local copy" "$([[ $(find "$work/backups" -name 'subs-*.dump.age' | wc -l | tr -d ' ') == 1 ]]; echo $?)"

echo "== retention (Sunday 2026-11-01, also the 1st)"
for d in $(seq -w 1 20); do put daily "subs-202610${d}T030000Z.dump.age"; done
for d in 04 11 18 25; do put weekly "subs-202610${d}T030000Z.dump.age"; done
put daily notes.txt
run_backup -e FAKE_NOW=2026-11-01T03:00:00Z > "$work/retention.log" 2>&1; code=$?
check "retention run exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/retention.log" | tr '\n' ' '))"
check "daily keeps 14" "$([[ $(count daily) == 14 ]]; echo $?)" "(found $(count daily))"
check "newest daily is today's" "$(has daily subs-20261101T030000Z.dump.age; echo $?)"
check "weekly has today's copy" "$(has weekly subs-20261101T030000Z.dump.age; echo $?)"
check "monthly has today's copy" "$(has monthly subs-20261101T030000Z.dump.age; echo $?)"
check "unrelated file untouched" "$(has daily notes.txt; echo $?)"

echo "== local copies"
run_backup -e FAKE_NOW=2026-11-02T03:00:00Z > /dev/null 2>&1
run_backup -e FAKE_NOW=2026-11-03T03:00:00Z > /dev/null 2>&1
check "local keeps 3" "$([[ $(find "$work/backups" -name 'subs-*.dump.age' | wc -l | tr -d ' ') == 3 ]]; echo $?)"

echo "== keep count 0 is refused"
before_zero="$(count daily)"
run_backup -e FAKE_NOW=2026-11-04T01:00:00Z -e BACKUP_KEEP_DAILY=0 > /dev/null 2>&1; code=$?
check "refuses keep 0" "$([[ $code != 0 ]]; echo $?)"
check "nothing deleted with keep 0" "$([[ $(count daily) -ge $before_zero ]]; echo $?)"

echo "== upload fails"
before_daily="$(count daily)"; before_success="$(status last_success_at)"
secret=wrong run_backup -e FAKE_NOW=2026-11-04T03:00:00Z > /dev/null 2>&1; code=$?
check "non-zero exit" "$([[ $code != 0 ]]; echo $?)"
check "status failed" "$([[ $(status last_run_ok) == false ]]; echo $?)"
check "last success unchanged" "$([[ $(status last_success_at) == "$before_success" ]]; echo $?)"
check "no new object" "$([[ $(count daily) == "$before_daily" ]]; echo $?)"
check "no partial files" "$([[ $(find "$work/backups" -name '*.partial' | wc -l | tr -d ' ') == 0 ]]; echo $?)"

echo "== restore"
newest="$(find "$(bucket daily)" -name 'subs-*.dump.age' -exec basename {} \; | sort -r | head -1)"
RESTORE_DOCKER_ARGS="$restore_args" RESTORE_IMAGE="$image" \
  bash "$repo/deploy/restore.sh" "daily/$newest" --yes < "$work/key/identity.txt" > "$work/restore.log" 2>&1; code=$?
check "restore exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/restore.log" | tr '\n' ' '))"
check "restored rows" "$([[ $(docker exec "$pg" psql -U subs -d subs_restore -tAc 'select count(*) from harness_rows' 2> /dev/null) == 3 ]]; echo $?)"
check "source untouched" "$([[ $(docker exec "$pg" psql -U subs -d subs -tAc 'select count(*) from harness_rows') == 3 ]]; echo $?)"
bash "$repo/deploy/restore.sh" "../../etc/passwd" --yes < /dev/null > /dev/null 2>&1; code=$?
check "restore rejects a malformed object name" "$([[ $code == 2 ]]; echo $?)"
echo "not a key" | RESTORE_DOCKER_ARGS="$restore_args" RESTORE_IMAGE="$image" \
  bash "$repo/deploy/restore.sh" "daily/$newest" --yes > /dev/null 2>&1; code=$?
check "restore refuses a wrong key" "$([[ $code != 0 ]]; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash deploy/tests/backup-harness.sh`
Expected: `FAIL  image build`.

- [ ] **Step 3: Image and cron**

`docker/prod/backup.Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# pg_dump must match the server's major version (Postgres 18).
FROM postgres:18-alpine
RUN apk add --no-cache age rclone bash coreutils
COPY --chmod=755 deploy/backup/backup.sh /usr/local/bin/backup.sh
COPY deploy/backup/crontab /etc/crontabs/root
ENV TZ=UTC
ENTRYPOINT []
CMD ["crond", "-f", "-l", "8"]
```

`deploy/backup/crontab`:

```
# Nightly at 03:00 UTC (musiband runs at 02:30). Output goes to the container log.
0 3 * * * /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1
```

- [ ] **Step 4: `backup.sh`**

`deploy/backup/backup.sh`:

```bash
#!/usr/bin/env bash
# One database backup: pg_dump → age (encrypted to BACKUP_AGE_RECIPIENT) → S3 bucket (daily/, plus weekly/ on Sundays
# and monthly/ on the 1st), then retention, then /status/status.json for backups:check.
# Runs nightly from cron in the backup container; by hand: docker compose … run --rm backup backup.sh
set -Eeuo pipefail

: "${DB_HOST:?}" "${DB_DATABASE:?}" "${DB_USERNAME:?}" "${DB_PASSWORD:?}" "${BACKUP_AGE_RECIPIENT:?}"
: "${BACKUP_S3_PROVIDER:?}" "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_KEY:?}" "${BACKUP_S3_SECRET:?}"
keep_daily="${BACKUP_KEEP_DAILY:-14}"
keep_weekly="${BACKUP_KEEP_WEEKLY:-8}"
keep_monthly="${BACKUP_KEEP_MONTHLY:-6}"
keep_local="${BACKUP_KEEP_LOCAL:-3}"
for keep in "$keep_daily" "$keep_weekly" "$keep_monthly" "$keep_local"; do
  # 0 or garbage would make retention delete every backup.
  [[ "$keep" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_KEEP_* must be whole numbers of at least 1 (got '${keep}')" >&2; exit 2; }
done

now="${FAKE_NOW:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
stamp="$(date -u -d "$now" +%Y%m%dT%H%M%SZ)"
name="subs-${stamp}.dump.age"
pattern='^subs-[0-9]{8}T[0-9]{6}Z\.dump\.age$'

# The rclone remote "b" comes from the environment only; nothing is written to disk.
export RCLONE_CONFIG_B_TYPE=s3 RCLONE_CONFIG_B_PROVIDER="$BACKUP_S3_PROVIDER" RCLONE_CONFIG_B_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_B_REGION="${BACKUP_S3_REGION:-auto}" RCLONE_CONFIG_B_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export RCLONE_CONFIG_B_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" RCLONE_CONFIG_B_NO_CHECK_BUCKET=true
remote="b:$BACKUP_S3_BUCKET"

mkdir -p /backups /status
step=start

# The last success survives failed runs (kept beside the status file).
last_success_at="" last_object="" last_size=""
if [[ -f /status/last_success ]]; then
  { read -r last_success_at; read -r last_object; read -r last_size; } < /status/last_success || true
fi

# shellcheck disable=SC1003 # the tr set is a double quote and a backslash
json() { [[ -z "$1" ]] && printf 'null' || printf '"%s"' "$(printf '%s' "$1" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-300)"; }

write_status() { # write_status <ok true|false> <error message>
  local size="${last_size:-null}"
  printf '{"last_run_at":%s,"last_run_ok":%s,"last_success_at":%s,"object":%s,"size_bytes":%s,"error":%s}\n' \
    "$(json "$now")" "$1" "$(json "$last_success_at")" "$(json "$last_object")" "$size" "$(json "$2")" > /status/status.json.tmp
  mv /status/status.json.tmp /status/status.json
}

on_error() {
  local code=$?
  rm -f /backups/*.partial
  write_status false "${step}: failed (exit ${code}), see the backup container log"
  echo "Backup failed at step ${step} (exit ${code})" >&2
  exit "$code"
}
trap on_error ERR

echo "Backup ${name}"

step=dump
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -Fc "$DB_DATABASE" | age -r "$BACKUP_AGE_RECIPIENT" -o "/backups/${name}.partial"
mv "/backups/${name}.partial" "/backups/${name}"
size="$(stat -c %s "/backups/${name}")"

step=upload
rclone copyto "/backups/${name}" "${remote}/daily/${name}"
if [[ "$(date -u -d "$now" +%u)" == 7 ]]; then rclone copyto "/backups/${name}" "${remote}/weekly/${name}"; fi
if [[ "$(date -u -d "$now" +%d)" == 01 ]]; then rclone copyto "/backups/${name}" "${remote}/monthly/${name}"; fi

last_success_at="$now" last_object="daily/${name}" last_size="$size"
printf '%s\n%s\n%s\n' "$last_success_at" "$last_object" "$last_size" > /status/last_success

step=retention
# Never deletes the backup this run made, even when the clock is behind and its name sorts oldest.
prune() { # prune <prefix> <keep>: delete all but the newest <keep> backups under <prefix>/ (names sort by time)
  rclone lsf "${remote}/$1/" --files-only 2> /dev/null | { grep -E "$pattern" || true; } | { grep -vxF "$name" || true; } \
    | sort -r | tail -n +"$2" \
    | while read -r old; do rclone deletefile "${remote}/$1/${old}"; echo "Deleted $1/${old}"; done
}
prune daily "$keep_daily"
prune weekly "$keep_weekly"
prune monthly "$keep_monthly"
# shellcheck disable=SC2012 # only this script's own, fixed-pattern file names live here
ls -1 /backups | { grep -E "$pattern" || true; } | { grep -vxF "$name" || true; } | sort -r | tail -n +"$keep_local" \
  | while read -r old; do rm -f "/backups/${old}"; done

write_status true ""
echo "Backup done: daily/${name} (${size} bytes)"
```

Retention arithmetic: the list excludes today's file, so `tail -n +14` deletes from the 14th-newest other file on and keeps 13 others plus today's = 14. Local: `tail -n +3` keeps 2 others plus today's = 3.

- [ ] **Step 5: `restore.sh`**

`deploy/restore.sh`:

```bash
#!/usr/bin/env bash
# Restores one backup into a SEPARATE database, subs_restore — never into subs.
# Usage (on the server, as deploy, in /srv/subs):  ./restore.sh daily/subs-20261105T030001Z.dump.age
# Asks for confirmation, then for the backup private key (AGE-SECRET-KEY-…, from the password manager) on stdin.
# The key goes straight into the container's stdin: it is never written to the server's disk.
# Switching production to the restored database is a manual step (README → Restore).
set -euo pipefail
cd "$(dirname "$0")"

object="${1:-}"
[[ "$object" =~ ^(daily|weekly|monthly)/subs-[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]] \
  || { echo "usage: restore.sh <daily|weekly|monthly>/subs-YYYYMMDDTHHMMSSZ.dump.age [--yes]" >&2; exit 2; }

if [[ "${2:-}" != "--yes" ]]; then
  read -r -p "This drops and recreates the database subs_restore (production is not touched). Continue? [y/N] " answer < /dev/tty
  [[ "$answer" =~ ^[yY]$ ]] || { echo "Cancelled."; exit 1; }
  echo "Paste the backup private key (AGE-SECRET-KEY-…), then press Enter and Ctrl+D:" > /dev/tty
fi

# Runs inside the backup image: download, decrypt with the key from stdin, restore, count rows.
read -r -d '' script << 'SCRIPT' || true
set -euo pipefail
umask 077
# The key stays in this process's memory; age reads it through a pipe (/dev/fd), never from a file.
key="$(tr -d '\r' | grep '^AGE-SECRET-KEY-' || true)"
[[ -n "$key" ]] || { echo "That is not an age private key." >&2; exit 1; }
export RCLONE_CONFIG_B_TYPE=s3 RCLONE_CONFIG_B_PROVIDER="$BACKUP_S3_PROVIDER" RCLONE_CONFIG_B_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_B_REGION="${BACKUP_S3_REGION:-auto}" RCLONE_CONFIG_B_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export RCLONE_CONFIG_B_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" RCLONE_CONFIG_B_NO_CHECK_BUCKET=true
export PGPASSWORD="$DB_PASSWORD"
echo "Downloading and decrypting $1"
rclone cat "b:$BACKUP_S3_BUCKET/$1" | age -d -i <(printf '%s\n' "$key") > /tmp/restore.dump
unset key
echo "Recreating subs_restore"
psql -h "$DB_HOST" -U "$DB_USERNAME" -d postgres -qv ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS subs_restore WITH (FORCE)' -c 'CREATE DATABASE subs_restore'
echo "Restoring"
pg_restore -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore --no-owner --no-privileges --exit-on-error /tmp/restore.dump
rm -f /tmp/restore.dump
echo "Rows in subs_restore:"
for table in users subscriptions services migrations; do
  if [[ "$(psql -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore -tAc "select to_regclass('public.$table') is not null")" == t ]]; then
    printf '  %-14s %s\n' "$table" "$(psql -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore -tAc "select count(*) from $table")"
  fi
done
echo "Restore finished."
SCRIPT

if [[ -n "${RESTORE_IMAGE:-}" ]]; then
  # Test harness: plain docker run with the connection given in RESTORE_DOCKER_ARGS (word splitting intended).
  # shellcheck disable=SC2086
  docker run --rm -i ${RESTORE_DOCKER_ARGS:-} "$RESTORE_IMAGE" bash -c "$script" restore "$object"
else
  TAG="$(cat current-tag)" docker compose -f compose.prod.yaml run --rm -T backup bash -c "$script" restore "$object"
fi
```

- [ ] **Step 6: Run the harness and shellcheck**

Run: `chmod +x deploy/backup/backup.sh deploy/restore.sh && bash deploy/tests/backup-harness.sh`
Expected: every line `PASS`, then `ALL PASS`.
Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy/backup/backup.sh deploy/restore.sh deploy/tests/backup-harness.sh`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add docker/prod/backup.Dockerfile deploy/backup deploy/restore.sh deploy/tests/backup-harness.sh
git commit -m "build: encrypted nightly database backups to R2, and a restore script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Production compose file and env templates

**Files:**
- Create: `compose.prod.yaml`, `deploy/.env.production.example`, `deploy/.env.backup.example`
- Test: `deploy/tests/secrets-separation.sh`

**Interfaces:**
- Consumes: images from Tasks 2–4; env keys from Task 1.
- Produces: services `app queue scheduler nginx edge db redis backup` with `TAG` required; `deploy.sh` (Task 6) starts them by these names.

- [ ] **Step 1: Write the failing test**

`deploy/tests/secrets-separation.sh`:

```bash
#!/usr/bin/env bash
# The app must not get the backup bucket key; the backup container must not get app secrets (needs docker, jq).
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
cp compose.prod.yaml "$d/"
cp deploy/.env.production.example "$d/.env"
cp deploy/.env.backup.example "$d/.env.backup"
sed -i.bak -e 's/^APP_KEY=$/APP_KEY=base64:appsecret/' -e 's/^DB_PASSWORD=$/DB_PASSWORD=dbpw/' -e 's/^REDIS_PASSWORD=$/REDIS_PASSWORD=redispw/' "$d/.env"
sed -i.bak 's/^BACKUP_S3_SECRET=$/BACKUP_S3_SECRET=bucketsecret/' "$d/.env.backup"
cfg="$(cd "$d" && TAG=t CLOUDFLARE_IPS_DIR=/tmp docker compose -f compose.prod.yaml config --format json)" || { echo "FAIL  compose config"; exit 1; }
fail=0
for svc in app queue scheduler; do
  [[ -z "$(jq -r ".services.$svc.environment.BACKUP_S3_SECRET // empty" <<< "$cfg")" ]] || { echo "FAIL  $svc sees the bucket secret"; fail=1; }
  [[ -n "$(jq -r ".services.$svc.environment.APP_KEY // empty" <<< "$cfg")" ]] || { echo "FAIL  $svc misses APP_KEY"; fail=1; }
done
[[ -z "$(jq -r '.services.backup.environment.APP_KEY // empty' <<< "$cfg")" ]] || { echo "FAIL  backup sees APP_KEY"; fail=1; }
[[ -n "$(jq -r '.services.backup.environment.DB_PASSWORD // empty' <<< "$cfg")" ]] || { echo "FAIL  backup misses DB_PASSWORD"; fail=1; }
[[ -n "$(jq -r '.services.backup.environment.BACKUP_S3_SECRET // empty' <<< "$cfg")" ]] || { echo "FAIL  backup misses the bucket secret"; fail=1; }
published="$(jq -r '[.services[] | (.ports // [])[] | .published] | join(",")' <<< "$cfg")"
[[ "$published" == "8443" ]] || { echo "FAIL  published ports are '$published', want only 8443"; fail=1; }
[[ "$(jq -r '.networks.internal.ipam.config[0].subnet' <<< "$cfg")" == "172.31.0.0/24" ]] || { echo "FAIL  subnet"; fail=1; }
if [[ $fail == 0 ]]; then echo PASS; else exit 1; fi
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash deploy/tests/secrets-separation.sh`
Expected: `cp: compose.prod.yaml: No such file or directory`, then `FAIL  compose config`.

- [ ] **Step 3: `compose.prod.yaml`**

```yaml
name: subs

x-logging: &logging
  driver: json-file
  options: { max-size: 10m, max-file: "3" }

x-api: &api
  image: ghcr.io/demotivationme/subs-api:${TAG:?TAG is required}
  env_file: .env
  volumes:
    - ./data/storage:/var/www/html/storage
  restart: unless-stopped
  logging: *logging
  depends_on:
    db: { condition: service_healthy }
    redis: { condition: service_started }
  networks: [internal]

services:
  app:
    <<: *api

  queue:
    <<: *api
    command: php artisan horizon

  scheduler:
    <<: *api
    command: php artisan schedule:work

  nginx:
    image: ghcr.io/demotivationme/subs-nginx:${TAG}
    restart: unless-stopped
    logging: *logging
    depends_on: [app]
    networks: [internal]

  # The only published port. Cloudflare's Origin Rule sends *.unsab.com here; musiband keeps 80/443.
  edge:
    image: ghcr.io/demotivationme/subs-edge:${TAG}
    ports: ["8443:443"]
    volumes:
      - ./certs:/etc/caddy/certs:ro
      # musiband's cloudflare-ips.sh keeps cloudflare-ips.caddy here current (monthly cron).
      - ${CLOUDFLARE_IPS_DIR:-/srv/musiband/caddy}:/etc/caddy/extra:ro
      - caddy-data:/data
    restart: unless-stopped
    logging: *logging
    depends_on: [nginx]
    networks: [internal]

  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: ${DB_DATABASE}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U ${DB_USERNAME} -d ${DB_DATABASE}"]
      interval: 5s
      timeout: 5s
      retries: 20
    restart: unless-stopped
    logging: *logging
    networks: [internal]

  redis:
    image: redis:8-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
    volumes:
      - ./data/redis:/data
    restart: unless-stopped
    logging: *logging
    networks: [internal]

  # Nightly encrypted database backup to unsab-backup (deploy/backup/backup.sh, cron 03:00 UTC).
  backup:
    image: ghcr.io/demotivationme/subs-backup:${TAG}
    # Only its own settings: the app's secrets stay out, and the app never sees the bucket key.
    env_file: .env.backup
    environment:
      DB_HOST: db
      DB_DATABASE: ${DB_DATABASE}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./data/storage/app/private/backups:/status
    restart: unless-stopped
    logging: *logging
    depends_on:
      db: { condition: service_healthy }
    networks: [internal]

networks:
  internal:
    ipam:
      config:
        - subnet: 172.31.0.0/24

volumes:
  caddy-data:
```

- [ ] **Step 4: Env templates**

`deploy/.env.production.example`:

```
# /srv/subs/.env — read by Docker Compose (DB_*, REDIS_PASSWORD) and by the app containers. Mode 600, owner deploy.
# Fill every empty value on the server; never commit the filled file.
APP_NAME=Unsab
APP_ENV=production
# php artisan key:generate --show (run locally)
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.unsab.com
FRONTEND_URL=https://unsab.com
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
LOG_CHANNEL=stderr
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=subs
DB_USERNAME=subs
DB_PASSWORD=

REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

# Brevo SMTP (sender domain unsab.com verified in Brevo; SPF/DKIM/DMARC in Cloudflare DNS)
MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=reminders@unsab.com
MAIL_FROM_NAME=Unsab

# Service logos on R2 (bucket unsab, public at media.unsab.com)
LOGO_DISK=r2
MEDIA_S3_KEY=
MEDIA_S3_SECRET=
MEDIA_S3_REGION=auto
MEDIA_S3_BUCKET=unsab
MEDIA_S3_ENDPOINT=
MEDIA_S3_PATH_STYLE=false
MEDIA_URL=https://media.unsab.com

# Expo push (optional until Expo's enhanced push security is on)
EXPO_ACCESS_TOKEN=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
SENTRY_LARAVEL_DSN=

ADMIN_DOMAIN=admin.unsab.com
# Comma-separated; the emails Cloudflare Access lets through and that may open Horizon.
ADMIN_EMAILS=
TRUSTED_PROXIES=172.31.0.0/24
```

`deploy/.env.backup.example`:

```
# /srv/subs/.env.backup — read ONLY by the backup container (compose.prod.yaml), never by the app:
# the bucket key can delete backups, so an attack on the app must not reach it. Mode 600, owner deploy.

# Recipient = the public key from `age-keygen` (age1…); the private key lives only in your password manager.
BACKUP_AGE_RECIPIENT=
# rclone S3 provider name for R2
BACKUP_S3_PROVIDER=Cloudflare
# https://<account id>.r2.cloudflarestorage.com
BACKUP_S3_ENDPOINT=
BACKUP_S3_REGION=auto
BACKUP_S3_BUCKET=unsab-backup
# An R2 token with Object Read & Write on unsab-backup only
BACKUP_S3_KEY=
BACKUP_S3_SECRET=
```

- [ ] **Step 5: Run the test**

Run: `bash deploy/tests/secrets-separation.sh`
Expected: `PASS`.

- [ ] **Step 6: Commit**

```bash
git add compose.prod.yaml deploy/.env.production.example deploy/.env.backup.example deploy/tests/secrets-separation.sh
git commit -m "build: production compose file publishing only 8443, with env templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `deploy.sh` with health check and rollback

**Files:**
- Create: `deploy/deploy.sh`
- Test: `deploy/tests/deploy-script-test.sh`

**Interfaces:**
- Consumes: `compose.prod.yaml` service names (Task 5); Artisan commands `migrate`, `db:seed --class=CatalogSeeder`, `rates:fetch`, `horizon:terminate`, `reminders:dispatch`.
- Produces: `deploy.sh <tag>` (exit 0 = live, non-zero = failed, previous tag restarted if there was one); writes `current-tag`. Env overrides for tests: `HEALTH_PORT` (default 8443), `HEALTH_TRIES` (30), `HEALTH_SLEEP` (2).

- [ ] **Step 1: Write the failing test**

`deploy/tests/deploy-script-test.sh`:

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the status of its own test on purpose
# Tests deploy.sh's decisions with fake docker/curl (no containers). Usage: bash deploy/tests/deploy-script-test.sh
set -uo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1"; failures=$((failures + 1)); fi; }

mkdir -p "$work/bin" "$work/srv"
cp "$repo/deploy/deploy.sh" "$work/srv/"
touch "$work/srv/compose.prod.yaml" "$work/backup-tags" "$work/bad-migrate-tags" "$work/healthy-tags"

# Fake docker: `up -d … app …` makes TAG the running one; migrate fails for tags in bad-migrate-tags; the backup
# image only exists for tags in backup-tags. Every call is logged to $WORK/calls.
cat > "$work/bin/docker" << 'FAKE'
#!/usr/bin/env bash
echo "TAG=${TAG:-} docker $*" >> "$WORK/calls"
if [[ "$*" == *"artisan migrate"* ]] && grep -qx "${TAG:-}" "$WORK/bad-migrate-tags"; then echo "migration failed" >&2; exit 1; fi
if [[ "$*" == *" up -d"* && "$*" == *backup* ]] && ! grep -qx "${TAG:-}" "$WORK/backup-tags"; then
  echo "pull access denied for subs-backup:${TAG:-}" >&2; exit 1
fi
if [[ "$*" == *" up -d"* && "$*" == *" app"* ]]; then echo "${TAG:-}" > "$WORK/running"; fi
exit 0
FAKE
# Fake curl: healthy only when the running tag is in healthy-tags; logs each call.
cat > "$work/bin/curl" << 'FAKE'
#!/usr/bin/env bash
echo "curl $*" >> "$WORK/calls"
grep -qx "$(cat "$WORK/running" 2> /dev/null)" "$WORK/healthy-tags"
FAKE
chmod +x "$work/bin/docker" "$work/bin/curl"
export PATH="$work/bin:$PATH" WORK="$work" HEALTH_TRIES=2 HEALTH_SLEEP=0
reset() { : > "$work/calls"; }

echo "== first deploy, healthy"
reset; printf 'v1\n' > "$work/healthy-tags"; printf 'v1\n' > "$work/backup-tags"
bash "$work/srv/deploy.sh" v1 > "$work/out" 2>&1; code=$?
check "succeeds" "$([[ $code == 0 ]]; echo $?)"
check "current-tag written" "$([[ $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"
check "never compose down" "$(! grep -q ' down' "$work/calls"; echo $?)"
check "never removes volumes" "$(! grep -qE ' -v( |$)|--volumes' "$work/calls"; echo $?)"
check "migrates before starting app" "$([[ $(grep -n 'artisan migrate' "$work/calls" | head -1 | cut -d: -f1) -lt $(grep -n ' up -d .* app' "$work/calls" | head -1 | cut -d: -f1) ]]; echo $?)"
check "heartbeat before health check" "$([[ $(grep -n 'reminders:dispatch' "$work/calls" | head -1 | cut -d: -f1) -lt $(grep -n '^curl' "$work/calls" | head -1 | cut -d: -f1) ]]; echo $?)"
check "seeds the catalog" "$(grep -q 'db:seed --class=CatalogSeeder --force' "$work/calls"; echo $?)"
check "checks api and landing on 8443" "$(grep -q 'api.unsab.com:8443:127.0.0.1' "$work/calls" && grep -q 'unsab.com:8443:127.0.0.1 https://unsab.com:8443/' "$work/calls"; echo $?)"

echo "== failed migration starts nothing"
reset; printf 'v2\n' > "$work/bad-migrate-tags"
bash "$work/srv/deploy.sh" v2 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "no service restarted" "$(! grep -q ' up -d .* app' "$work/calls"; echo $?)"
check "v1 still live" "$([[ $(cat "$work/running") == v1 && $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"

echo "== unhealthy release rolls back"
reset; : > "$work/bad-migrate-tags"
bash "$work/srv/deploy.sh" v3 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "v1 running again" "$([[ $(cat "$work/running") == v1 ]]; echo $?)"
check "current-tag unchanged" "$([[ $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"
check "rollback reported" "$(grep -q 'Rolling back to v1' "$work/out"; echo $?)"

echo "== missing backup image only warns"
reset; printf 'v1\nv4\n' > "$work/healthy-tags"
bash "$work/srv/deploy.sh" v4 > "$work/out" 2>&1; code=$?
check "succeeds" "$([[ $code == 0 ]]; echo $?)"
check "backup problem reported" "$(grep -qi 'backup' "$work/out"; echo $?)"

echo "== first deploy unhealthy, nothing to roll back to"
reset; rm -f "$work/srv/current-tag" "$work/running"
bash "$work/srv/deploy.sh" v5 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "no rollback attempted" "$(! grep -q 'Rolling back' "$work/out"; echo $?)"

echo "== unsafe tag refused"
reset
bash "$work/srv/deploy.sh" 'x;touch pwned' > "$work/out" 2>&1; code=$?
check "exit 2" "$([[ $code == 2 ]]; echo $?)"
check "nothing ran" "$([[ ! -s "$work/calls" ]]; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash deploy/tests/deploy-script-test.sh`
Expected: `cp: …/deploy/deploy.sh: No such file or directory` and FAIL lines.

- [ ] **Step 3: Write `deploy.sh`**

`deploy/deploy.sh`:

```bash
#!/usr/bin/env bash
# Deploys one image tag on the server: pull, migrate, restart, health-check, roll back on failure.
# Usage: deploy.sh <tag>      (run as deploy in /srv/subs)
set -euo pipefail
cd "$(dirname "$0")"

new_tag="${1:-}"
[[ "$new_tag" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "usage: deploy.sh <tag>  (letters, digits, . _ - only)" >&2; exit 2; }
previous_tag="$(cat current-tag 2> /dev/null || true)"
compose() { TAG="$1" docker compose -f compose.prod.yaml "${@:2}"; }

# Through the edge with the real host names (SNI), as Cloudflare connects. HEALTH_PORT only differs in local tests.
healthy() {
  local port="${HEALTH_PORT:-8443}"
  for _ in $(seq 1 "${HEALTH_TRIES:-30}"); do
    if curl -fsSk -o /dev/null --resolve "api.unsab.com:${port}:127.0.0.1" "https://api.unsab.com:${port}/up" \
      && curl -fsSk -o /dev/null --resolve "unsab.com:${port}:127.0.0.1" "https://unsab.com:${port}/"; then
      return 0
    fi
    sleep "${HEALTH_SLEEP:-2}"
  done
  return 1
}

# Returns non-zero instead of exiting, so a version that fails to start still reaches the rollback.
start() {
  compose "$1" up -d --remove-orphans app queue scheduler nginx edge || return 1
  # The backup job is not part of serving the API: a missing backup image must not block a deploy or a rollback.
  compose "$1" up -d backup || echo "Warning: the backup service did not start for $1" >&2
  compose "$1" exec -T app php artisan db:seed --class=CatalogSeeder --force || return 1
  # A down ECB must not fail the deploy; the daily schedule retries.
  compose "$1" exec -T app php artisan rates:fetch || echo "Warning: rates:fetch failed; the scheduler retries daily" >&2
  compose "$1" exec -T app php artisan horizon:terminate || true
  # Writes the scheduler heartbeat that /up checks, so a first deploy is healthy before the first 15-minute run.
  compose "$1" exec -T app php artisan reminders:dispatch || return 1
}

echo "Deploying ${new_tag} (live: ${previous_tag:-none})"
compose "$new_tag" pull app nginx edge
compose "$new_tag" pull backup || echo "Warning: could not pull the backup image for ${new_tag}" >&2
compose "$new_tag" up -d --wait db redis

# A failed migration stops here; the running containers are untouched.
compose "$new_tag" run --rm --no-deps app php artisan migrate --force

if start "$new_tag" && healthy; then
  echo "$new_tag" > current-tag
  # Drop releases older than a week that no container uses; a rollback to one of them pulls it again from GHCR.
  docker image prune -af --filter "until=168h" > /dev/null
  echo "Deployed ${new_tag}"
  exit 0
fi

echo "Health check failed for ${new_tag}" >&2
if [[ -n "$previous_tag" ]]; then
  echo "Rolling back to ${previous_tag}" >&2
  { start "$previous_tag" && healthy; } || echo "Previous version is not healthy either" >&2
fi
exit 1
```

Note: `docker image prune` is global on the server, exactly as musiband's deploy already does; it removes only images no container uses, so it never touches musiband's running images.

- [ ] **Step 4: Run the test and shellcheck**

Run: `chmod +x deploy/deploy.sh && bash deploy/tests/deploy-script-test.sh`
Expected: all `PASS`, `ALL PASS`.
Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy/deploy.sh deploy/tests/deploy-script-test.sh deploy/tests/secrets-separation.sh deploy/tests/edge-test.sh docker/prod/entrypoint.sh`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add deploy/deploy.sh deploy/tests/deploy-script-test.sh
git commit -m "build: deploy.sh with health check through the edge and automatic rollback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: CI images, Deploy and Rollback workflows

**Files:**
- Modify: `.github/workflows/backend.yml`
- Create: `.github/workflows/deploy.yml`, `.github/workflows/rollback.yml`

**Interfaces:**
- Consumes: Dockerfiles and targets (Tasks 2–4), deploy tests (Tasks 3–6).
- Produces: GHCR images `subs-api`, `subs-nginx`, `subs-edge`, `subs-backup` tagged `${{ github.sha }}` and `tree-<tree hash>`; repository secrets used: `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.

- [ ] **Step 1: Extend `backend.yml`**

Change the top of `.github/workflows/backend.yml` to:

```yaml
name: backend

# Tests every push and pull request. On dev and main it also builds the production images, tagged with the commit
# and with its content ("tree-<tree hash>"); Deploy on main only looks those up.
on: [push, pull_request]

permissions:
  contents: read
```

and append these two jobs after `test` (same indentation as `test:`):

```yaml
  deploy-config:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Shell scripts
        run: shellcheck deploy/*.sh deploy/backup/*.sh deploy/tests/*.sh docker/prod/entrypoint.sh
      - name: Production compose file
        run: |
          cp deploy/.env.production.example .env
          cp deploy/.env.backup.example .env.backup
          REDIS_PASSWORD=x TAG=check CLOUDFLARE_IPS_DIR=/tmp docker compose -f compose.prod.yaml config -q
      - name: Secrets stay separated (app vs backup)
        run: bash deploy/tests/secrets-separation.sh
      - name: deploy.sh decisions
        run: bash deploy/tests/deploy-script-test.sh
      - name: Edge routing
        run: bash deploy/tests/edge-test.sh
      - name: Backup and restore
        run: bash deploy/tests/backup-harness.sh

  images:
    needs: [test, deploy-config]
    if: github.event_name == 'push' && (github.ref == 'refs/heads/dev' || github.ref == 'refs/heads/main')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        include:
          - { name: subs-api, file: docker/prod/api.Dockerfile, target: app }
          - { name: subs-nginx, file: docker/prod/api.Dockerfile, target: nginx }
          - { name: subs-edge, file: docker/prod/edge.Dockerfile, target: '' }
          - { name: subs-backup, file: docker/prod/backup.Dockerfile, target: '' }
    steps:
      - uses: actions/checkout@v4
      - name: Content tag
        id: tree
        run: echo "tag=tree-$(git rev-parse 'HEAD^{tree}')" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ matrix.file }}
          target: ${{ matrix.target }}
          push: true
          # Re-pull the floating base images so security patches land on every rebuild.
          pull: true
          tags: |
            ghcr.io/demotivationme/${{ matrix.name }}:${{ github.sha }}
            ghcr.io/demotivationme/${{ matrix.name }}:${{ steps.tree.outputs.tag }}
          cache-from: type=gha,scope=${{ matrix.name }}
          cache-to: type=gha,mode=max,scope=${{ matrix.name }}
```

- [ ] **Step 2: `deploy.yml`**

```yaml
name: Deploy

# Releases what is on main. Builds nothing: the backend workflow built and tested the images when this content was
# pushed to dev (tag tree-<tree hash>, identical for the dev commit and the merge on main).
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: read

jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    concurrency:
      group: production-subs
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Production images for this content
        id: images
        env:
          REF: ${{ github.sha }}
        run: |
          tree="$(git rev-parse "${REF}^{tree}")"
          for tag in "tree-${tree}" "${REF}"; do
            missing=""
            for name in subs-api subs-nginx subs-edge subs-backup; do
              docker manifest inspect "ghcr.io/demotivationme/${name}:${tag}" > /dev/null 2>&1 || missing="${missing} ${name}"
            done
            if [[ -z "$missing" ]]; then echo "tag=${tag}" >> "$GITHUB_OUTPUT"; echo "Deploying images ${tag}"; exit 0; fi
          done
          echo "::error::No production images for this content (missing:${missing}). Push the commit to dev, let the backend workflow finish (it builds the images), then release again." >&2
          exit 1
      - name: SSH key
        env:
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/id_ed25519 && chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
      - name: Ship deploy files
        env:
          HOST: ${{ secrets.DEPLOY_HOST }}
        run: scp compose.prod.yaml deploy/deploy.sh deploy/restore.sh "deploy@${HOST}:/srv/subs/"
      - name: Deploy
        env:
          HOST: ${{ secrets.DEPLOY_HOST }}
          TAG: ${{ steps.images.outputs.tag }}
        run: |
          # shellcheck disable=SC2029 # expands here on purpose; TAG comes from the verified image lookup above
          ssh "deploy@${HOST}" "/srv/subs/deploy.sh ${TAG}"
```

- [ ] **Step 3: `rollback.yml`**

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      sha:
        description: Full commit SHA of a version that was released before (its images must still exist in GHCR)
        required: true

permissions:
  contents: read
  packages: read

jobs:
  rollback:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    concurrency:
      group: production-subs
      cancel-in-progress: false
    steps:
      - name: Check the input
        env:
          SHA: ${{ inputs.sha }}
        run: '[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Not a full commit SHA" >&2; exit 1; }'
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Production images for this content
        id: images
        env:
          REF: ${{ inputs.sha }}
        run: |
          tree="$(git rev-parse "${REF}^{tree}")"
          for tag in "tree-${tree}" "${REF}"; do
            missing=""
            for name in subs-api subs-nginx subs-edge subs-backup; do
              docker manifest inspect "ghcr.io/demotivationme/${name}:${tag}" > /dev/null 2>&1 || missing="${missing} ${name}"
            done
            if [[ -z "$missing" ]]; then echo "tag=${tag}" >> "$GITHUB_OUTPUT"; echo "Deploying images ${tag}"; exit 0; fi
          done
          echo "::error::No production images for ${REF} (missing:${missing})." >&2
          exit 1
      - name: SSH key
        env:
          DEPLOY_SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          DEPLOY_KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/id_ed25519 && chmod 600 ~/.ssh/id_ed25519
          printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/known_hosts
      - name: Deploy the chosen version
        env:
          HOST: ${{ secrets.DEPLOY_HOST }}
          TAG: ${{ steps.images.outputs.tag }}
        run: |
          # shellcheck disable=SC2029 # expands here on purpose; TAG comes from the verified image lookup above
          ssh "deploy@${HOST}" "/srv/subs/deploy.sh ${TAG}"
```

- [ ] **Step 4: Lint the workflows**

Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color .github/workflows/backend.yml .github/workflows/deploy.yml .github/workflows/rollback.yml`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/backend.yml .github/workflows/deploy.yml .github/workflows/rollback.yml
git commit -m "ci: build production images on dev and main, deploy main over SSH, manual rollback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: EAS production profile

**Files:**
- Create: `app/eas.json`

**Interfaces:**
- Produces: EAS build profiles `development`, `preview`, `production`; `production` sets `EXPO_PUBLIC_API_URL=https://api.unsab.com/api/v1`. Development keeps `app/.env`.

- [ ] **Step 1: Check the EAS CLI's current schema**

Per `app/AGENTS.md`, read https://docs.expo.dev/build/eas-json/ (fetch it) and confirm `build.<profile>.env`, `developmentClient`, `distribution` and `cli.appVersionSource` are still the field names.

- [ ] **Step 2: Write `app/eas.json`**

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://api.unsab.com/api/v1" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.unsab.com/api/v1" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: Validate**

Run: `cd app && npx expo-doctor 2>&1 | tail -5 && node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8')); console.log('eas.json ok')"`
Expected: `eas.json ok`, and no expo-doctor line mentions `eas.json`.

- [ ] **Step 4: Commit**

```bash
git add app/eas.json
git commit -m "chore(app): EAS build profiles; preview and production use api.unsab.com

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Remove the old single-server setup and document the new one

**Files:**
- Delete: `docker-compose.prod.yml`, `.env.prod.example`, `docker/bin/deploy.sh`, `docker/bin/backup.sh`, `docker/php/Dockerfile.prod`, `docker/caddy/Caddyfile`
- Modify: `README.md` (replace the whole `## Production (OVH)` section, up to the next `## ` heading or the end of the file)

**Interfaces:**
- Consumes: everything above; file paths and commands must match Tasks 1–8 exactly.

- [ ] **Step 1: Confirm nothing else references the old files**

Run: `git grep -nE 'docker-compose\.prod|\.env\.prod\.example|docker/bin/(deploy|backup)|Dockerfile\.prod|docker/caddy' -- ':!docs'`
Expected: only `README.md` lines (which Step 3 replaces). If anything else appears, stop and report it.

- [ ] **Step 2: Delete them**

```bash
git rm docker-compose.prod.yml .env.prod.example docker/bin/deploy.sh docker/bin/backup.sh docker/php/Dockerfile.prod docker/caddy/Caddyfile
```

- [ ] **Step 3: New README section**

Replace the `## Production (OVH)` section with:

````markdown
## Production

Subs runs on the OVH server next to musiband, in `/srv/subs`, as Docker Compose project `subs`. Its Caddy publishes
only port **8443**; a Cloudflare Origin Rule sends the unsab host names there, so musiband keeps 80/443 untouched.

| Host | Serves |
|---|---|
| `api.unsab.com` | the API (`/horizon` and `/api/admin/*` answer 404 here) |
| `admin.unsab.com` | behind Cloudflare Access: Horizon now, the admin panel later |
| `unsab.com` (`www` redirects) | the landing page (`landing/index.html`) |
| `media.unsab.com` | R2 bucket `unsab` (service logos) |

### Releasing

1. Push to `dev`. The backend workflow tests it and builds `subs-api`, `subs-nginx`, `subs-edge` and `subs-backup`
   into GHCR, tagged with the commit and its content (`tree-<hash>`).
2. Merge `dev` into `main`. **Deploy** finds those images, copies `compose.prod.yaml`, `deploy.sh` and `restore.sh`
   to the server and runs `deploy.sh <tag>`: pull, migrate (a failure stops there), restart, seed the catalog, fetch
   rates, health-check `https://api.unsab.com/up` and `https://unsab.com/` through the edge, and roll back to the
   previous tag if they fail.
3. To go back to an older release: Actions → **Rollback** → the full commit SHA.

### First-time setup

1. **Server (root).** Create the folder, and let only Cloudflare reach 8443. Docker's published ports bypass ufw, so
   this matters: without it 8443 is open to the internet.
   ```bash
   install -d -o deploy -g deploy /srv/subs /srv/subs/certs
   sed -i 's/for port in 80 443; do/for port in 80 443 8443; do/' /srv/musiband/cloudflare-ips.sh
   /srv/musiband/cloudflare-ips.sh --firewall
   iptables -S DOCKER-USER | grep -c 'ctorigdstport 8443'   # must print 1
   ```
   The same one-line change is on musiband's branch `subs-port-8443`; merge it there so a future musiband change to
   the script keeps 8443.
2. **Cloudflare (zone unsab.com).**
   - SSL/TLS → Overview: **Full (strict)**.
   - SSL/TLS → Origin Server → Create Certificate for `unsab.com, *.unsab.com` (15 years). Save the certificate as
     `/srv/subs/certs/origin.pem` and the key as `/srv/subs/certs/origin.key` (mode 600, owner deploy).
   - DNS: proxied `A` records `unsab.com`, `www`, `api`, `admin` → the server's IP (and `AAAA` if it has IPv6).
   - Rules → Origin Rules → Create: *Hostname* `ends with` `unsab.com` **and** *Hostname* `does not equal`
     `media.unsab.com` → Destination Port **8443**.
   - Zero Trust → Access → Applications → Self-hosted: `admin.unsab.com`, policy *Allow* with your email.
3. **Email (Brevo).** Senders & IP → Domains → add `unsab.com`; add the SPF, DKIM and DMARC records Brevo shows to
   Cloudflare DNS (DNS only, not proxied). Create an SMTP key for `MAIL_PASSWORD`.
4. **Backups.** In R2, create a token with **Object Read & Write** on `unsab-backup` only. On your own computer run
   `age-keygen -o subs-backup.key`; put the `age1…` public key in `.env.backup` and keep `subs-backup.key` in your
   password manager, never on the server.
5. **Env files (as deploy).** Copy `deploy/.env.production.example` to `/srv/subs/.env` and
   `deploy/.env.backup.example` to `/srv/subs/.env.backup`, fill every empty value, `chmod 600` both.
   `APP_KEY` comes from `php artisan key:generate --show`; use new random `DB_PASSWORD` and `REDIS_PASSWORD`.
6. **GitHub (subs repo → Settings → Secrets → Actions).** `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` —
   the same values musiband uses.
7. **Check the firewall from outside** (any machine that is not Cloudflare): `nc -z -w3 <server-ip> 8443` must fail.
8. **First release:** merge `dev` into `main` (or Actions → Deploy → Run workflow). Then open
   `https://api.unsab.com/up`, `https://unsab.com` and `https://admin.unsab.com` (Access asks you to log in first).

### Operations

- Logs: `cd /srv/subs && TAG=$(cat current-tag) docker compose -f compose.prod.yaml logs -f app queue edge`.
- Backups run at 03:00 UTC; `backups:check` logs an error hourly when the last success is older than 26 hours or the
  last run failed. Run one now: `TAG=$(cat current-tag) docker compose -f compose.prod.yaml run --rm backup backup.sh`.
- **Restore** into a separate database `subs_restore` (production is not touched):
  `./restore.sh daily/subs-YYYYMMDDTHHMMSSZ.dump.age`, then paste the private key. Switching production to it is a
  manual `DB_DATABASE=subs_restore` change in `.env` followed by a redeploy of the same tag.

### Local development and the media bucket

Point your local `backend/.env` at a separate bucket (for example `unsab-dev` with its free `r2.dev` URL as
`MEDIA_URL`), so dev uploads and catalog seeds never land in the production bucket `unsab`.
````

- [ ] **Step 4: Verify the README commands match the code**

Run: `grep -n 'for port in 80 443; do' /Users/demo/Sites/musiband/deploy/cloudflare-ips.sh`
Expected: exactly one match (the `sed` in step 1 of the README depends on it).
Run: `git grep -nE 'docker-compose\.prod|docker/bin/|Dockerfile\.prod' -- ':!docs'`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add -A README.md
git commit -m "docs: production on the shared server; remove the single-server setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: musiband firewall change on a local branch

**Files:**
- Modify (in `/Users/demo/Sites/musiband`): `deploy/cloudflare-ips.sh`, `deploy/server/musiband-firewall.service`

**Interfaces:**
- Produces: musiband branch `subs-port-8443` (local only, never pushed) with the guard over ports `80 443 8443`.

- [ ] **Step 1: Branch from musiband's dev without disturbing its working tree**

```bash
cd /Users/demo/Sites/musiband
git status --porcelain   # must be empty; if not, stop and report: do not stash or touch the user's changes
git switch -c subs-port-8443 dev
```

- [ ] **Step 2: Make the change**

In `deploy/cloudflare-ips.sh`:
- line `#  - with --firewall (as root): only Cloudflare may reach ports 80/443. …` → `… ports 80/443 (musiband) and 8443 (subs). …`
- `    for port in 80 443; do` → `    for port in 80 443 8443; do`

In `deploy/server/musiband-firewall.service`: `Description=Musiband: only Cloudflare may reach ports 80/443 (DOCKER-USER filter)` → `Description=Musiband and Subs: only Cloudflare may reach ports 80/443/8443 (DOCKER-USER filter)`.

- [ ] **Step 3: Check and commit**

Run: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable deploy/cloudflare-ips.sh && git diff --stat`
Expected: no shellcheck output; 2 files changed.

```bash
git commit -am "deploy(firewall): also guard 8443, where Subs's edge listens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git switch dev
```

Leave the branch unpushed and tell the user it exists.
