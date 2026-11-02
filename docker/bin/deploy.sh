#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

git pull --ff-only

# Web app: static export served by Caddy from ./app/dist. Built in a throwaway Node
# container so the server needs no Node; dist is refilled in place because Caddy
# bind-mounts that directory.
env_value() { grep -E "^$1=" "$2" | tail -1 | cut -d= -f2-; }
API_DOMAIN="$(env_value API_DOMAIN .env)"
VAPID_PUBLIC_KEY="$(env_value VAPID_PUBLIC_KEY backend/.env)"
mkdir -p app/dist
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/app:/app" -w /app \
    -e EXPO_PUBLIC_API_URL="https://${API_DOMAIN:?set API_DOMAIN in .env}/api/v1" \
    -e EXPO_PUBLIC_VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" \
    node:24-alpine sh -c 'npm ci --no-audit --no-fund && npx expo export -p web --output-dir dist.new \
        && find dist -mindepth 1 -delete && cp -a dist.new/. dist/ && rm -rf dist.new'

$COMPOSE build php
# Stop containers (never -v: pgdata must survive) so the public volume can be
# removed and refilled from the new image.
$COMPOSE down
docker volume rm subs_public 2>/dev/null || true
$COMPOSE up -d
$COMPOSE exec -T php php artisan migrate --force
# Preset categories and the service catalog (idempotent upserts); the API needs Category::other().
$COMPOSE exec -T php php artisan db:seed --class=CatalogSeeder --force
# Exchange rates otherwise first arrive with the daily schedule; a down ECB must not fail the deploy.
$COMPOSE exec -T php php artisan rates:fetch \
    || echo "deploy: rates:fetch failed (ECB unreachable?); the scheduler will retry daily." >&2
$COMPOSE exec -T php php artisan optimize
$COMPOSE exec -T php php artisan horizon:terminate
$COMPOSE exec -T php php artisan reminders:dispatch   # writes the first heartbeat for /up
