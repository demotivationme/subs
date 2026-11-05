#!/usr/bin/env bash
# Restores one backup into a SEPARATE database, subs_restore — never into subs.
# Usage (on the server, as deploy, in /srv/subs):  ./restore.sh daily/subs-20261105T030001Z.dump.age
# Asks for confirmation, then for the backup private key (AGE-SECRET-KEY-…, from the password manager) on stdin.
# The key goes straight into the container's stdin: it is never written to the server's disk.
# Switching production to the restored database is a manual step (README → Restore).
set -euo pipefail
cd "$(dirname "$0")"

object="${1:-}"
[[ "$object" =~ ^(daily|weekly|monthly)/subs-[0-9]{8}T[0-9]{6}Z\.dump\.age$ ]] \
  || { echo "usage: restore.sh <daily|weekly|monthly>/subs-YYYYMMDDTHHMMSSZ.dump.age [--yes]" >&2; exit 2; }

if [[ "${2:-}" != "--yes" ]]; then
  read -r -p "This drops and recreates the database subs_restore (production is not touched). Continue? [y/N] " answer < /dev/tty
  [[ "$answer" =~ ^[yY]$ ]] || { echo "Cancelled."; exit 1; }
  echo "Paste the backup private key (AGE-SECRET-KEY-…), then press Enter and Ctrl+D:" > /dev/tty
fi

# Runs inside the backup image: download, decrypt with the key from stdin, restore, count rows.
read -r -d '' script << 'SCRIPT' || true
set -euo pipefail
umask 077
# The key stays in this process's memory; age reads it through a pipe (/dev/fd), never from a file.
key="$(tr -d '\r' | grep '^AGE-SECRET-KEY-' || true)"
[[ -n "$key" ]] || { echo "That is not an age private key." >&2; exit 1; }
export RCLONE_CONFIG_B_TYPE=s3 RCLONE_CONFIG_B_PROVIDER="$BACKUP_S3_PROVIDER" RCLONE_CONFIG_B_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_B_REGION="${BACKUP_S3_REGION:-auto}" RCLONE_CONFIG_B_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export RCLONE_CONFIG_B_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" RCLONE_CONFIG_B_NO_CHECK_BUCKET=true
export PGPASSWORD="$DB_PASSWORD"
echo "Downloading and decrypting $1"
rclone cat "b:$BACKUP_S3_BUCKET/$1" | age -d -i <(printf '%s\n' "$key") > /tmp/restore.dump
unset key
echo "Recreating subs_restore"
psql -h "$DB_HOST" -U "$DB_USERNAME" -d postgres -qv ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS subs_restore WITH (FORCE)' -c 'CREATE DATABASE subs_restore'
echo "Restoring"
pg_restore -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore --no-owner --no-privileges --exit-on-error /tmp/restore.dump
rm -f /tmp/restore.dump
echo "Rows in subs_restore:"
for table in users subscriptions services migrations; do
  if [[ "$(psql -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore -tAc "select to_regclass('public.$table') is not null")" == t ]]; then
    printf '  %-14s %s\n' "$table" "$(psql -h "$DB_HOST" -U "$DB_USERNAME" -d subs_restore -tAc "select count(*) from $table")"
  fi
done
echo "Restore finished."
SCRIPT

if [[ -n "${RESTORE_IMAGE:-}" ]]; then
  # Test harness: plain docker run with the connection given in RESTORE_DOCKER_ARGS (word splitting intended).
  # shellcheck disable=SC2086
  docker run --rm -i ${RESTORE_DOCKER_ARGS:-} "$RESTORE_IMAGE" bash -c "$script" restore "$object"
else
  TAG="$(cat current-tag)" docker compose -f compose.prod.yaml run --rm -T backup bash -c "$script" restore "$object"
fi
