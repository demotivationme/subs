# Subs — MVP Design Spec

**Date:** 2026-10-31
**Status:** Draft, awaiting review

## 1. Purpose

Subs is a subscription tracker for iOS, Android and web. Users record every recurring
subscription they pay for (YouTube, Spotify, Netflix, …), see how much they spend per
month and per year, and get reminders before each payment through the channels they choose, so they can get rid of
subscriptions that they are already not using. 

### MVP scope

In scope:
- Email + password accounts (verification, password reset, account deletion)
- Subscriptions: service (catalog or user-created), category (preset or custom),
  amount + currency, period, first payment date
- Dashboard: monthly total, yearly total, by-category breakdown, upcoming 30 days, most expensive
- Reminders: N days before payment, at a user-chosen time of day, via push, in-app and/or email
- Multi-currency with totals in the user's main currency. When adding a subscription, the
  currency field is prefilled with the user's main currency and can be changed.
- English UI with full i18n infrastructure on backend and app

Deferred to launch (design must not block them):
- Freemium billing (free up to N subscriptions; paid unlocks more + email/push reminders)
  via RevenueCat (App Store / Play Store) and Stripe (web). MVP keeps only `users.is_premium`
  and a disabled limit check.
- Sign in with Apple and Google
- Filament admin panel for the service catalog (MVP uses a seeder)
- Blade marketing landing page
- Real-time updates (Laravel Reverb)
- EAS Build / Submit to the stores

Out of scope: family sharing, bank-account syncing, offline editing.

### Definition of done

A user can register on iOS, Android and web, add subscriptions (from the catalog or their own),
see correct monthly and yearly totals in their main currency, and receive reminders at the
time they picked, through each channel they chose, exactly once.

## 2. Architecture

Monorepo:

```
subs/
├── backend/                  Laravel 12, PHP 8.4+
│   ├── app/Http/Controllers/Api/V1/
│   ├── app/Models/
│   ├── app/Services/         BillingCycle, SpendCalculator, CurrencyConverter
│   ├── app/Notifications/    PaymentReminder
│   ├── app/Console/Commands/ reminders:dispatch, rates:fetch
│   └── lang/en/
├── app/                      Expo (latest stable SDK), TypeScript, Expo Router
│   ├── app/                  file-based routes → iOS, Android, Web
│   ├── src/api/              typed API client + TanStack Query hooks
│   ├── src/i18n/locales/en.json
│   └── src/components/
├── docker-compose.yml
└── docs/
```

- The Expo app (all platforms) calls `https://api.<domain>/api/v1/*` with a Sanctum bearer token.
- Laravel: PostgreSQL 17 for data; Redis for queues and cache; Horizon processes the queue;
  the Scheduler runs `reminders:dispatch` (every 15 min) and `rates:fetch` (daily).
- Push: Laravel → Expo Push API (iOS/Android) and Web Push with VAPID keys (browsers).
- Email: Mailpit locally; Postmark or Amazon SES in production.

## 3. Data model

Money is stored as integer minor units (cents) plus an ISO 4217 currency code.
Billing dates are `date` columns. Times of day are interpreted in the user's IANA timezone.

| Table | Columns |
|---|---|
| `users` | id, name, email, password, email_verified_at, `timezone` (IANA, from device at signup), `currency` (main currency), `locale` (default `en`), `is_premium` bool default false |
| `categories` | id, `user_id` NULL (NULL = global preset), `key` NULL (translation key for presets), `name` NULL (custom), icon, color |
| `services` | id, `user_id` NULL (NULL = catalog), name, slug, `logo_path` NULL, `default_category_id` |
| `subscriptions` | id, user_id, service_id, category_id, `amount` int, `currency`, `period` enum(week, month, year), `interval_count` int ≥1, `first_payment_date`, `next_payment_date`, `status` enum(active, paused, cancelled), notes NULL, timestamps, soft deletes |
| `reminder_rules` | id, user_id, `subscription_id` NULL (NULL = user default), `days_before` int 0–60, `time_of_day` time, `channels` jsonb ⊆ {push, in_app, email} |
| `sent_reminders` | id, subscription_id, reminder_rule_id, payment_date, created_at — UNIQUE(subscription_id, reminder_rule_id, payment_date) |
| `device_tokens` | id, user_id, `token` UNIQUE, `platform` enum(ios, android), last_seen_at |
| `push_subscriptions` | from `laravel-notification-channels/webpush` |
| `notifications` | Laravel database channel (in-app inbox) |
| `exchange_rates` | date, base (`EUR`), quote, rate decimal — UNIQUE(date, quote) |

Rules:
- **Effective reminder rules:** if a subscription has any rules of its own, they replace the
  user's defaults. Otherwise the user's default rules apply.
- **Signup default:** one rule, 1 day before at 09:00, channels push + in_app.
- **Category labels:** presets show `t('categories.<key>')`; custom categories show `name`.
- **Deleting a custom category** moves its subscriptions to the preset `other`.
- **Preset categories (keys):** entertainment, music, video_streaming, gaming, software_cloud,
  news_reading, fitness_health, education, utilities_telecom, shopping_delivery, finance, other.

## 4. Billing cycle (date math)

`BillingCycle::nth(first_payment_date, period, interval_count, k)` =
`first_payment_date + k × interval_count × period`, using Carbon `add*NoOverflow`.
It always computes from the anchor date, never by stepping from the previous date, so a
Jan 31 monthly subscription gives Feb 28 → Mar 31 → Apr 30 (no drift).

`next_payment_date` = the smallest nth date ≥ today in the user's timezone.
It is recomputed on create/update and moved forward by `reminders:dispatch`.

## 5. API (`/api/v1`, JSON)

All routes except the auth routes require `auth:sanctum`. Laravel Policies limit every
read and write to the user's own rows. Global rows are read-only.

```
Auth
  POST   /auth/register           {name,email,password,timezone,currency,locale,device_name} → {token,user}
  POST   /auth/login              {email,password,device_name} → {token,user}
  POST   /auth/logout
  POST   /auth/forgot-password    POST /auth/reset-password
  POST   /auth/email/resend       GET  /auth/email/verify/{id}/{hash}  (signed)
  GET    /me    PATCH /me (name,timezone,currency,locale)    DELETE /me

Catalog
  GET    /categories                       global + mine
  POST   /categories    PATCH|DELETE /categories/{id}   (own only)
  GET    /services?q=                      catalog + mine, name search
  POST   /services                         {name, default_category_id}

Subscriptions
  GET    /subscriptions?status=&category_id=&sort=price|next_payment|name
  POST   /subscriptions   {service_id | service_name, category_id?, amount, currency,
                           period, interval_count, first_payment_date, notes?}
  GET|PATCH|DELETE /subscriptions/{id}
  GET|PUT /subscriptions/{id}/reminders    PUT [] = revert to defaults

Reminders & notifications
  GET|PUT /reminder-defaults
  POST   /devices {token, platform}        DELETE /devices/{token}
  POST   /webpush/subscribe                DELETE /webpush/subscribe
  GET    /notifications?page=              GET /notifications/unread-count
  POST   /notifications/{id}/read          POST /notifications/read-all

Dashboard
  GET    /dashboard
```

- `POST /subscriptions` with `service_name` (and no `service_id`) creates a service owned
  by the user, or reuses the user's own service with the same name (case-insensitive).
  `category_id` defaults to the service's `default_category_id`, then to `other`.
- Errors use Laravel's standard JSON shape: 422 `{message, errors}`, 401, 403, 404, 429.
  Messages come from `lang/`.
- Rate limits: auth endpoints 5/min per IP + email; API 120/min per user.

## 6. Dashboard (`SpendCalculator`)

Monthly equivalent for each active subscription:
- week: `amount × 52 / 12 / interval_count`
- month: `amount / interval_count`
- year: `amount / (12 × interval_count)`

Each amount is converted to the user's main currency with the latest available rate
(cross rates via EUR). Response:

```json
{
  "currency": "EUR",
  "monthly_total": 8734,
  "yearly_total": 104808,
  "count": 9,
  "by_category": [{"category_id": 1, "monthly": 3200, "percent": 36.6}],
  "upcoming": [{"subscription_id": 4, "date": "2026-11-02", "amount": 1299, "currency": "EUR"}],
  "most_expensive": [{"subscription_id": 7, "monthly": 2999}],
  "unconverted": [{"subscription_id": 3, "currency": "XYZ"}]
}
```

- `upcoming` lists every payment in the next 30 days, in original amounts.
- `unconverted` lists subscriptions whose currency has no rate. They are left out of the totals.
- Cached in Redis per user. The cache is cleared on any change to the user's subscriptions,
  on a currency change, and after `rates:fetch`.

`rates:fetch` (daily) pulls the ECB euro reference rates (no API key). Missing days fall back
to the most recent stored rate.

## 7. Reminder pipeline (`reminders:dispatch`, every 15 min, `withoutOverlapping`)

1. **Advance:** for active subscriptions whose `next_payment_date` is before today (user's
   timezone), recompute it from the anchor (§4).
2. **Find due:** for each active subscription and each of its effective rules, the reminder
   moment is `(next_payment_date − days_before) at time_of_day` in the user's timezone,
   converted to UTC. It is due if `now − 24h < moment ≤ now` and no matching
   `sent_reminders` row exists. Moments older than 24h are skipped.
3. **Send:** insert the `sent_reminders` row first (the unique constraint guarantees
   exactly-once), then queue `PaymentReminder`.
4. **Channels (`via()`):** `push` → Expo channel if the user has device tokens, plus WebPush
   if they have push subscriptions; `in_app` → `database`; `email` → `mail`, only if the
   email is verified. Each channel is queued separately and retried 3× with backoff.
5. **Cleanup:** an Expo `DeviceNotRegistered` result deletes the device token; a Web Push
   404/410 deletes the push subscription.
6. **Heartbeat:** each run stores a timestamp in the cache. `/up` reports unhealthy if the
   last run is older than 30 minutes.

Paused and cancelled subscriptions get no reminders.
Text comes from `lang/<locale>/notifications.php`, e.g. "Netflix renews tomorrow — €12.99",
"Spotify renews in 7 days — $10.99". The payload includes `subscription_id` for deep linking.

## 8. App (Expo)

**Stack:** TypeScript strict, Expo Router, TanStack Query, Zustand (auth/settings),
react-hook-form + zod, i18next + react-i18next + expo-localization, Intl for money/dates,
NativeWind (light/dark), victory-native / victory behind one `<SpendChart>`,
expo-notifications (mobile), service worker `public/sw.js` (web), expo-secure-store (mobile
token) / localStorage (web token).

**Routes:**
```
(auth)/login · register · forgot-password
(app)/(tabs)/index          Dashboard
(app)/(tabs)/subscriptions  List, filter by category/status, sort by price/next date/name
(app)/(tabs)/notifications  In-app inbox; unread badge on the header bell
(app)/(tabs)/settings       Profile, currency, timezone, language, default reminders,
                            push toggle, log out, delete account
subscriptions/new           1) search catalog or type a new name
                            2) amount + currency, period × N, first payment date, category
                            3) optional reminder override
subscriptions/[id]          Details, edit, pause/cancel/delete, own reminders
categories                  Manage custom categories
```

**Behavior:**
- Ask for push permission after the first subscription is saved, after a short explanation
  screen. If granted, register via `POST /devices` (mobile) or `POST /webpush/subscribe` (web).
- Tapping a notification opens `subscriptions/[id]`.
- The inbox and unread count refresh when the app opens or comes back to the foreground.
- A 401 clears the token and redirects to login.
- Offline: cached data is shown read-only.
- Unverified email: a banner explains that email reminders need verification.

**i18n rules:**
- No user-facing literal strings; an ESLint rule enforces this in JSX.
- Plurals use i18next plural forms.
- Adding a language = add `app/src/i18n/locales/<xx>.json` and `backend/lang/<xx>/`, then
  add `<xx>` to `SUPPORTED_LOCALES` in both. No other code changes.

## 9. Seed data

- 12 preset categories (§3).
- About 60 international catalog services, each with a default category (e.g. Netflix →
  video_streaming, Spotify → music, iCloud+ → software_cloud, Xbox Game Pass → gaming).
- Local only: a demo user `demo@subs.test` with sample subscriptions in several currencies.

## 10. Testing

**Backend (Pest, real Postgres in Docker):**
- `BillingCycle`: Jan 31 monthly, Feb 29 yearly, weekly, every 3 months, future first date.
- `SpendCalculator`: period normalization, currency conversion, unconverted currencies.
- Auth flow; subscription CRUD; policies (cross-user access denied); creating a service by
  name; category deletion moving subscriptions to `other`.
- Reminder pipeline with `travelTo`: timezone correctness, exactly-once, 24h catch-up window,
  override beats defaults, paused subscriptions skipped, unverified email skips `mail`,
  channel selection checked with `Notification::fake()`.

**App (Jest + React Native Testing Library):**
- Subscription form validation, money formatting.
- Every translation key used in the code exists in `en.json`.

**CI (GitHub Actions):** backend runs Pint + Pest; app runs tsc + ESLint + Jest.

## 11. Local development

`docker compose up` starts nginx, php-fpm 8.4, postgres 17, redis, horizon, scheduler and
mailpit (UI on :8025). The Expo app runs on the host (`npx expo start`) with
`EXPO_PUBLIC_API_URL` pointing to the Docker API.

## 12. Deployment (OVH dedicated server)

- Docker Compose with a production override. Caddy terminates TLS (automatic Let's Encrypt)
  for `api.<domain>` and `app.<domain>`.
- Postgres on a persistent volume; nightly `pg_dump` to OVH Object Storage.
- Deploy: `git pull` → build → `php artisan migrate --force` → `php artisan horizon:terminate`.
- Web app: `npx expo export -p web`, served as static files at `app.<domain>`.
- Monitoring: `/up` healthcheck (includes scheduler heartbeat); optional Sentry via DSN env vars.
- Mobile store builds (EAS) are deferred to launch.
