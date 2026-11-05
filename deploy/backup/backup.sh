#!/usr/bin/env bash
# One database backup: pg_dump → age (encrypted to BACKUP_AGE_RECIPIENT) → S3 bucket (daily/, plus weekly/ on Sundays
# and monthly/ on the 1st), then retention, then /status/status.json for backups:check.
# Runs nightly from cron in the backup container; by hand: docker compose … run --rm backup backup.sh
set -Eeuo pipefail

: "${DB_HOST:?}" "${DB_DATABASE:?}" "${DB_USERNAME:?}" "${DB_PASSWORD:?}" "${BACKUP_AGE_RECIPIENT:?}"
: "${BACKUP_S3_PROVIDER:?}" "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_KEY:?}" "${BACKUP_S3_SECRET:?}"
keep_daily="${BACKUP_KEEP_DAILY:-14}"
keep_weekly="${BACKUP_KEEP_WEEKLY:-8}"
keep_monthly="${BACKUP_KEEP_MONTHLY:-6}"
keep_local="${BACKUP_KEEP_LOCAL:-3}"
for keep in "$keep_daily" "$keep_weekly" "$keep_monthly" "$keep_local"; do
  # 0 or garbage would make retention delete every backup.
  [[ "$keep" =~ ^[1-9][0-9]*$ ]] || { echo "BACKUP_KEEP_* must be whole numbers of at least 1 (got '${keep}')" >&2; exit 2; }
done

now="${FAKE_NOW:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
stamp="$(date -u -d "$now" +%Y%m%dT%H%M%SZ)"
name="subs-${stamp}.dump.age"
pattern='^subs-[0-9]{8}T[0-9]{6}Z\.dump\.age$'

# The rclone remote "b" comes from the environment only; nothing is written to disk.
export RCLONE_CONFIG_B_TYPE=s3 RCLONE_CONFIG_B_PROVIDER="$BACKUP_S3_PROVIDER" RCLONE_CONFIG_B_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_B_REGION="${BACKUP_S3_REGION:-auto}" RCLONE_CONFIG_B_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export RCLONE_CONFIG_B_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET" RCLONE_CONFIG_B_NO_CHECK_BUCKET=true
remote="b:$BACKUP_S3_BUCKET"

mkdir -p /backups /status
step=start

# The last success survives failed runs (kept beside the status file).
last_success_at="" last_object="" last_size=""
if [[ -f /status/last_success ]]; then
  { read -r last_success_at; read -r last_object; read -r last_size; } < /status/last_success || true
fi

# shellcheck disable=SC1003 # the tr set is a double quote and a backslash
json() { [[ -z "$1" ]] && printf 'null' || printf '"%s"' "$(printf '%s' "$1" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-300)"; }

write_status() { # write_status <ok true|false> <error message>
  local size="${last_size:-null}"
  printf '{"last_run_at":%s,"last_run_ok":%s,"last_success_at":%s,"object":%s,"size_bytes":%s,"error":%s}\n' \
    "$(json "$now")" "$1" "$(json "$last_success_at")" "$(json "$last_object")" "$size" "$(json "$2")" > /status/status.json.tmp
  mv /status/status.json.tmp /status/status.json
}

on_error() {
  local code=$?
  rm -f /backups/*.partial
  write_status false "${step}: failed (exit ${code}), see the backup container log"
  echo "Backup failed at step ${step} (exit ${code})" >&2
  exit "$code"
}
trap on_error ERR

echo "Backup ${name}"

step=dump
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USERNAME" -Fc "$DB_DATABASE" | age -r "$BACKUP_AGE_RECIPIENT" -o "/backups/${name}.partial"
mv "/backups/${name}.partial" "/backups/${name}"
size="$(stat -c %s "/backups/${name}")"

step=upload
rclone copyto "/backups/${name}" "${remote}/daily/${name}"
if [[ "$(date -u -d "$now" +%u)" == 7 ]]; then rclone copyto "/backups/${name}" "${remote}/weekly/${name}"; fi
if [[ "$(date -u -d "$now" +%d)" == 01 ]]; then rclone copyto "/backups/${name}" "${remote}/monthly/${name}"; fi

last_success_at="$now" last_object="daily/${name}" last_size="$size"
printf '%s\n%s\n%s\n' "$last_success_at" "$last_object" "$last_size" > /status/last_success

step=retention
# Never deletes the backup this run made, even when the clock is behind and its name sorts oldest.
prune() { # prune <prefix> <keep>: delete all but the newest <keep> backups under <prefix>/ (names sort by time)
  rclone lsf "${remote}/$1/" --files-only 2> /dev/null | { grep -E "$pattern" || true; } | { grep -vxF "$name" || true; } \
    | sort -r | tail -n +"$2" \
    | while read -r old; do rclone deletefile "${remote}/$1/${old}"; echo "Deleted $1/${old}"; done
}
prune daily "$keep_daily"
prune weekly "$keep_weekly"
prune monthly "$keep_monthly"
# shellcheck disable=SC2012 # only this script's own, fixed-pattern file names live here
ls -1 /backups | { grep -E "$pattern" || true; } | { grep -vxF "$name" || true; } | sort -r | tail -n +"$keep_local" \
  | while read -r old; do rm -f "/backups/${old}"; done

write_status true ""
echo "Backup done: daily/${name} (${size} bytes)"
