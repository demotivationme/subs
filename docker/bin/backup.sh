#!/usr/bin/env bash
# Nightly: dump Postgres and upload to OVH Object Storage (S3-compatible, configured via `aws configure`).
set -euo pipefail
cd "$(dirname "$0")/../.."

# Root .env (also read by Docker Compose) may hold BACKUP_BUCKET / BACKUP_ENDPOINT.
if [ -f ./.env ]; then set -a; . ./.env; set +a; fi

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/subs-${STAMP}.sql.gz"
trap 'rm -f "$FILE"' EXIT

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U subs subs | gzip > "$FILE"
aws s3 cp "$FILE" "s3://${BACKUP_BUCKET:?set BACKUP_BUCKET}/postgres/" --endpoint-url "${BACKUP_ENDPOINT:?set BACKUP_ENDPOINT}"
