# Subs

Subscription tracker — Laravel API (`backend/`) + Expo app for iOS, Android and web (`app/`).

## Local backend

```bash
docker compose up -d --build
docker compose exec php composer install
cp backend/.env.example backend/.env   # first time only
docker compose exec php php artisan key:generate
docker compose exec php php artisan webpush:vapid
docker compose exec php php artisan migrate --seed
docker compose exec php php artisan rates:fetch
docker compose exec php php artisan storage:link   # once: serves uploaded service logos from /storage
```

- After pulling changes that touch `docker/` or composer files, run `docker compose up -d --build` so php, horizon and scheduler all get the new image (stale horizon/scheduler images make queued reminders fail).
- API: http://localhost:8080/api/v1 · Health: http://localhost:8080/up
- Mail: http://localhost:8025 · Queues: http://localhost:8080/horizon
- Catalog logos are Simple Icons (CC0), seeded by `CatalogSeeder`; source and licence in `backend/database/seeders/logos/README.md`.
- Demo login: `demo@subs.test` / `password`
- Tests: `docker compose exec php ./vendor/bin/pest`

## Backend layering

Request → DTO → service → repository, enforced by `tests/Arch/LayersTest.php`:

- **FormRequest** (`app/Http/Requests`) validates and returns a DTO via `toInput()`.
- **DTO** (`app/Data`) is a `final readonly` class carrying that input.
- **Controller** passes the DTO to one service and wraps the result in a Resource; it never touches models or repositories.
- **Service** (`app/Services`) holds the business rules, including policy checks (`Gate::forUser($user)->authorize(...)`), and reads and writes only through repositories (`TransactionRunner` for atomic groups).
- **Repository** (`app/Repositories`) is an interface plus an `Eloquent…` implementation, bound in `RepositoryServiceProvider`. It is the only place that runs queries.

## App (Expo)

```bash
cd app
cp .env.example .env      # set EXPO_PUBLIC_VAPID_PUBLIC_KEY to backend/.env's VAPID_PUBLIC_KEY for web push
npm install
npx expo start            # w = web (http://localhost:8081), i = iOS simulator, a = Android emulator
```

- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api/v1`; a phone: your machine's LAN IP.
- Checks: `npm run typecheck && npm run lint && npm test`.
- Routes live in `src/app/` as one-line re-exports of `src/screens/`; tests sit next to the code (never in `src/app/`).
- Design ("Clear Ledger"): `docs/design/canvas/*.dc.html`; amendment in `docs/superpowers/plans/2026-11-02-subs-app-design-amendment.md`. Tabs: Home / Subscriptions / Stats / Settings; the inbox sits behind the bell.
- First run shows onboarding (`/welcome`) before sign-up.
- Mobile push needs an EAS project id (`npx eas-cli@latest init`) and a development build (`npx expo run:ios|android`).
  Until then mobile push shows "unsupported"; in-app and email reminders work, and web push works with the VAPID key.

## Adding a language

1. Copy `backend/lang/en/` to `backend/lang/<xx>/` and translate.
2. Add `<xx>` to `locales` in `backend/config/subs.php`.
3. In the app, add `app/src/i18n/locales/<xx>.json`, add `<xx>` to `SUPPORTED_LOCALES` and to `resources` in `app/src/i18n/index.ts`.

## Production (OVH)

On the server, one time:
1. Point DNS for `api.<domain>` and `app.<domain>` at the server.
2. Clone the repo and create `backend/.env` from `.env.example`:
   - `APP_ENV=production`, `APP_DEBUG=false`
   - `APP_URL=https://api.<domain>`, `FRONTEND_URL=https://app.<domain>`
   - a strong `DB_PASSWORD`, plus Postmark/SES `MAIL_*`
   - VAPID keys and `EXPO_ACCESS_TOKEN`
3. Copy `.env.prod.example` to `.env` (repo root, git-ignored; Docker Compose loads it automatically) and fill in `API_DOMAIN`, `APP_DOMAIN` and `POSTGRES_PASSWORD` (same value as `DB_PASSWORD`), plus `BACKUP_BUCKET` and `BACKUP_ENDPOINT`.
4. Run `./docker/bin/deploy.sh`. Besides migrating, it seeds the preset categories and service catalog (`db:seed --class=CatalogSeeder`, safe to rerun) and fetches today's exchange rates (`rates:fetch`; if the ECB is unreachable it only warns, and the daily schedule retries).
5. Cron: `0 3 * * * /path/to/subs/docker/bin/backup.sh` (reads `BACKUP_*` from the root `.env`).

To deploy updates, run `./docker/bin/deploy.sh` again. The web app is exported into `app/dist` by the script (in a throwaway Node container) and served by Caddy. Uploaded service logos live in the persistent `subs_storage_public` volume.

Note: the Horizon dashboard gate (`app/Providers/HorizonServiceProvider.php`) has an empty email list, so `/horizon` is denied outside local. Add the allowed admin emails there before using `/horizon` in production.
