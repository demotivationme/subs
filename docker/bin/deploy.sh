#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

git pull --ff-only
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
