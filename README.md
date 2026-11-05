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
3. To go back to an older release: Actions → **Rollback** → the full commit SHA. A rollback runs the previous code
   against the already-migrated database, so migrations must stay backward-compatible with the previous release (add
   columns and tables first, drop them in a later release).

### First-time setup

1. **Server (root).** Create the folders, and let only Cloudflare reach 8443. Docker's published ports bypass ufw, so
   this matters: without it 8443 is open to the internet. The storage tree must belong to the app's container user
   (www-data, uid 82); otherwise Docker creates the bind-mount folders as root and the app cannot write to them.
   ```bash
   install -d -o deploy -g deploy /srv/subs /srv/subs/certs
   install -d -o 82 -g 82 /srv/subs/data/storage /srv/subs/data/storage/app /srv/subs/data/storage/app/private /srv/subs/data/storage/app/private/backups
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
6. **Image access (as deploy).** The server pulls the images from GHCR: `docker login ghcr.io -u demotivationme` with a
   GitHub token that has `read:packages`. If deploy is already logged in to ghcr.io for musiband under the same
   account, this is done (`cat ~/.docker/config.json` shows `ghcr.io`).
7. **GitHub (subs repo → Settings → Secrets → Actions).** `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` —
   the same values musiband uses.
8. **Check the firewall from outside** (any machine that is not Cloudflare): `nc -z -w3 <server-ip> 8443` must fail.
9. **First release:** merge `dev` into `main` (or Actions → Deploy → Run workflow). Then open
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
