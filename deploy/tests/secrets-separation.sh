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
