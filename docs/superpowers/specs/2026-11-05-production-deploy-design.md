# Production deploy on the shared OVH server — design

Date: 2026-11-05 · Status: approved in conversation, awaiting spec review · Branch: `dev`

## Goal

Run Subs in production on the OVH server that already runs musiband, without either project being able to take
the other down. `api.unsab.com` serves the API to the apps, `unsab.com` a landing page, and `admin.unsab.com` is
reserved (behind Cloudflare Access) for the admin panel, which is a separate project. Releases go out from `master`
through GitHub Actions with a health check and automatic rollback, and the database is backed up nightly.

## Decisions

| Topic | Decision |
|---|---|
| Sharing the server | **Own port.** Subs publishes only `8443`; a Cloudflare Origin Rule sends the unsab host names there. Musiband keeps `80/443` and its edge is never touched. |
| Model | Copy musiband's pipeline: CI builds images to GHCR, a push to `master` deploys them over SSH, `deploy.sh` health-checks and rolls back. |
| Host names | `api.unsab.com` (API), `unsab.com` + `www` (landing), `admin.unsab.com` (placeholder now, admin panel later). `media.unsab.com` stays on R2. |
| Web app | Not deployed. No `app.unsab.com`; the Expo web export leaves the production path. |
| Backups | Nightly, encrypted with `age`, to the R2 bucket **`unsab-backup`** with its own token. |
| Server | OVH, 12 cores, 62 GB RAM (60 free), 379 GB disk free. Subs gets its own Postgres and Redis. |

## Server layout

- `/srv/subs`, owned by the existing `deploy` user. Compose project name `subs`, network `subs_internal` on
  `172.31.0.0/24` (musiband uses `172.30.0.0/24`).
- Files there: `compose.prod.yaml`, `deploy.sh`, `restore.sh` (shipped by the workflow), `.env`, `.env.backup`,
  `certs/origin.pem` + `certs/origin.key`, `current-tag`, `data/` (postgres, redis, storage), `backups/` (local copies).

### Services (`compose.prod.yaml`)

| Service | Image | Notes |
|---|---|---|
| `app` | `ghcr.io/demotivationme/subs-api:${TAG}` | php-fpm, `env_file: .env`, `data/storage` mounted |
| `queue` | `subs-api` | `php artisan horizon` |
| `scheduler` | `subs-api` | `php artisan schedule:work` |
| `nginx` | `subs-nginx` | serves `public/`, passes PHP to `app` |
| `edge` | `subs-edge` | Caddy; the only published port: `8443:443`; landing page built into the image |
| `db` | `postgres:18-alpine` | healthcheck, `data/postgres` |
| `redis` | `redis:8-alpine` | `--appendonly yes`, `data/redis` |
| `backup` | `subs-backup` | cron in the container; `env_file: .env.backup` only |

All services `restart: unless-stopped`, json-file logs capped at 10 MB × 3, on `subs_internal` only.

### Edge (Caddy)

- `auto_https disable_certs`; every site uses the Cloudflare Origin Certificate from `/etc/caddy/certs`.
- Trusts Cloudflare's ranges for `CF-Connecting-IP` (the same `cloudflare-ips.caddy` snippet musiband generates,
  mounted read-only from `/srv/musiband/caddy`, so there is one source of the ranges).
- Forwarding headers as in musiband: drop client `X-Forwarded-Port/Prefix`, set `X-Forwarded-For {client_ip}`,
  `X-Forwarded-Proto https`, `X-Forwarded-Host {host}`.
- Sites:
  - `api.unsab.com` → `nginx:80`; `/api/admin/*` and `/horizon*` answer 404.
  - `admin.unsab.com` → `/horizon*` to `nginx:80`; everything else a static "Admin coming soon" page.
    `X-Frame-Options DENY`, `nosniff`, `Referrer-Policy same-origin`.
  - `unsab.com` → the landing page (static files); `www.unsab.com` → 301 to `https://unsab.com{uri}`.

### Landing page

Static HTML and CSS in `landing/` (no build step): the Renewal loop logo, the product name, one line on what it
does, and App Store / Google Play badges marked "Coming soon". Light and dark via `prefers-color-scheme`. Copied
into the edge image.

## Cloudflare (set up by the user; README steps)

- DNS: proxied `A` records only (no `AAAA`: the origin is IPv4-only and the firewall guard covers IPv4) for `unsab.com`, `www`, `api`, `admin` → the server.
- Origin Rule: *Hostname ends with `unsab.com`* and *not equals `media.unsab.com`* → destination port `8443`.
- SSL/TLS mode **Full (strict)**; an Origin Certificate for `unsab.com, *.unsab.com` saved to `/srv/subs/certs/`.
- Zero Trust Access application on `admin.unsab.com`, allowing only the owner's email.

## Firewall (the one change on the musiband side)

Docker's published ports bypass ufw, so without this `8443` would be open to the internet. In
`/srv/musiband/cloudflare-ips.sh` the guarded ports become `80 443 8443` (one loop). The script is root-owned and
updated by hand: the README gives the exact edit and the command to re-apply it
(`sudo /srv/musiband/cloudflare-ips.sh --firewall`). The same edit goes into musiband's repository so the two stay
in step. The `deploy` user cannot read iptables, so `deploy.sh` does not check the rule; the first-time checklist
verifies it from outside instead (`nc -z -w3 <server-ip> 8443` must fail from a non-Cloudflare host) before the
first deploy.

## Images and CI

`backend.yml` keeps its test job. A new `images` job runs after it on pushes to `dev` and `master`:

- Builds and pushes `subs-api`, `subs-nginx`, `subs-edge`, `subs-backup` to GHCR, tagged `tree-<git tree hash>`
  and the commit SHA. The tree tag is identical for a `dev` commit and its merge into `master`, so a release never
  rebuilds.
- Dockerfiles live in `docker/prod/` (`api.Dockerfile`, `nginx.Dockerfile`, `edge.Dockerfile`,
  `backup.Dockerfile`), replacing `docker/php/Dockerfile.prod` and `docker/caddy/Caddyfile`.
- `api` image: PHP 8.5 fpm, production `php.ini` (opcache on), `composer install --no-dev`, runs as `www-data`.
- Validates `compose.prod.yaml` with `docker compose config` (dummy `TAG`).

## Deploy

### `deploy.yml`

On push to `master` and `workflow_dispatch`: find the images for this content (tree tag, then SHA; fail with a clear
message if missing), load `DEPLOY_SSH_KEY` / `DEPLOY_KNOWN_HOSTS`, `scp` `compose.prod.yaml`, `deploy.sh`,
`restore.sh` to `deploy@$DEPLOY_HOST:/srv/subs/`, run `/srv/subs/deploy.sh <tag>`. `concurrency: production-subs`.

### `rollback.yml`

`workflow_dispatch` with a `tag` input (default: the previous tag, read from the server); runs `deploy.sh <tag>`.

### `deploy.sh <tag>` (on the server)

1. Pull `app nginx edge` (and `backup`, warning only on failure); `up -d --wait db redis`.
2. `run --rm --no-deps app php artisan migrate --force`. A failure stops here; the live version keeps running.
3. Start `app queue scheduler nginx edge` (and `backup`, warning only), then in `app`: `db:seed --class=CatalogSeeder
   --force`, `rates:fetch` (warning only), `optimize`, `horizon:terminate`, `reminders:dispatch` (first heartbeat
   for `/up`).
4. Health check through the edge with real host names:
   `curl --resolve api.unsab.com:8443:127.0.0.1 https://api.unsab.com:8443/up` and the same for `unsab.com/`,
   30 tries, 2 s apart.
5. Healthy → write `current-tag`, prune images older than a week that nothing uses. Not healthy → start the previous
   tag and check it; exit non-zero either way so the workflow fails.

Never `down`, never `-v`.

## Backups

- `subs-backup` image: Alpine with `postgresql18-client`, `age`, `rclone`, `cron`. `backup.sh` adapted from
  musiband's: `pg_dump -Fc` → `age` to `BACKUP_AGE_RECIPIENT` → `unsab-backup` under `daily/`, plus `weekly/` on
  Sundays and `monthly/` on the 1st; keeps 14 / 8 / 6 and the last 3 locally; writes `status.json`.
- Cron at **03:00 UTC** (musiband runs at 02:30).
- `.env.backup` holds only `BACKUP_S3_*` (R2 endpoint, bucket `unsab-backup`, a token with Object Read & Write on
  that bucket only) and `BACKUP_AGE_RECIPIENT`. The app container never sees them; the backup container gets the DB
  credentials through `environment:` only.
- `restore.sh <object>` downloads, decrypts with an identity file given on the command line, and restores into a
  fresh database (documented, never run by the pipeline).
- `backups:check` (Artisan, scheduled daily) logs an error when `status.json` is older than 26 hours or failed.

## Production settings

`/srv/subs/.env`, written by the user from a committed `.env.production.example` (keys only, no values):

- `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://api.unsab.com`, new `APP_KEY`, `LOG_CHANNEL=stderr`.
- `DB_HOST=db`, `DB_*` with a new password; `REDIS_HOST=redis` with a password.
- `LOGO_DISK=r2`, `MEDIA_S3_*`, `MEDIA_URL=https://media.unsab.com`.
- Mail through Brevo: `MAIL_MAILER=smtp`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=587`,
  `MAIL_FROM_ADDRESS=reminders@unsab.com`. `unsab.com` is added as a Brevo sender domain and its SPF, DKIM and
  DMARC records go into Cloudflare DNS.
- `EXPO_ACCESS_TOKEN` (optional until Expo's enhanced push security is turned on).
- `ADMIN_EMAILS` (comma-separated): read through `config/subs.php`; the Horizon gate uses it instead of the empty
  list in `HorizonServiceProvider`. The admin panel will reuse it.
- `TRUSTED_PROXIES=172.31.0.0/24`: `bootstrap/app.php` trusts only the Subs network instead of all private
  ranges; the real client IP comes from Caddy's `X-Forwarded-For` (set from `CF-Connecting-IP`).

Dev recommendation (not enforced): local `.env` moves to a separate `unsab-dev` media bucket on its `r2.dev` URL, so
dev uploads and seeds never land in the production bucket.

The app's EAS `production` profile sets `EXPO_PUBLIC_API_URL=https://api.unsab.com/api/v1`; development builds and
Expo Go keep the LAN URL from `app/.env`.

## Removed

`docker-compose.prod.yml`, `docker/bin/deploy.sh`, `docker/bin/backup.sh`, `docker/php/Dockerfile.prod`,
`docker/caddy/Caddyfile`, and the README's old "Production (OVH)" section, which describe a server Subs owns alone.

## First-time setup (README checklist)

1. Root on the server: `install -d -o deploy -g deploy /srv/subs`; apply the firewall edit and re-run
   `cloudflare-ips.sh --firewall`.
2. Cloudflare: Origin Certificate → `/srv/subs/certs/`; DNS records; Origin Rule; SSL Full (strict); Access app.
3. Write `/srv/subs/.env` and `/srv/subs/.env.backup`; generate the age key pair offline and keep the identity file
   off the server.
4. GitHub (subs repo): secrets `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
5. Merge `dev` into `master` (or run Deploy by hand); check `https://api.unsab.com/up`, `https://unsab.com`,
   `https://admin.unsab.com` (Access login first), and that `<server-ip>:8443` refuses non-Cloudflare clients.

## Tests

- `deploy/tests/deploy-script-test.sh` (run in CI): `deploy.sh` against a fake `docker`/`curl` on `PATH` —
  success writes `current-tag`; a failed migration starts nothing; a failed health check rolls back to the previous
  tag and exits non-zero; a first deploy with no previous tag exits non-zero without a rollback.
- `deploy/tests/secrets-separation.sh`: the rendered compose file gives `backup` no `env_file: .env` and the API
  services no `.env.backup`.
- `deploy/tests/backup-harness.sh`: `backup.sh` with fake `pg_dump`/`rclone` — names, retention, refusal of
  non-numeric `BACKUP_KEEP_*`, `status.json` on failure.
- Pest: `/horizon` gate allows `ADMIN_EMAILS` and denies others; `backups:check` errors on a stale or failed status;
  trusted proxies come from `TRUSTED_PROXIES`.
- CI: `docker compose -f compose.prod.yaml config` passes; `caddy validate` on the edge image.

## Out of scope

- The admin panel itself (separate spec; this one only reserves `admin.unsab.com` and the Horizon route).
- Sign in with Google and Apple (its own plan; it gets the production host names from here).
- Publishing the Expo web app, store listings, EAS production builds and submission.
- Moving musiband onto a shared edge.
