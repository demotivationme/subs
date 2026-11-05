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
  docker image prune -af --filter "until=168h" > /dev/null || echo "Warning: image prune failed" >&2
  echo "Deployed ${new_tag}"
  exit 0
fi

echo "Health check failed for ${new_tag}" >&2
if [[ -n "$previous_tag" ]]; then
  echo "Rolling back to ${previous_tag}" >&2
  { start "$previous_tag" && healthy; } || echo "Previous version is not healthy either" >&2
fi
exit 1
