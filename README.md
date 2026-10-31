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
