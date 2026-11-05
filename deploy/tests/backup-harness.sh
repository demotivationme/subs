#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the exit status of its own test expression on purpose
# End-to-end test of the backup job and restore.sh: Postgres, an S3 server standing in for the bucket (`rclone serve s3`
# over a local folder, from the backup image itself) and a throwaway age key. Usage: bash deploy/tests/backup-harness.sh
set -uo pipefail

repo="$(cd "$(dirname "$0")/../.." && pwd)"
net=subs-backup-test
pg=sbt-db
s3=sbt-s3
image=subs-backup:test
work="$(mktemp -d)"
failures=0

cleanup() {
  docker rm -f "$pg" "$s3" > /dev/null 2>&1
  docker network rm "$net" > /dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT

check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1 ${3:-}"; failures=$((failures + 1)); fi; }

bucket() { echo "$work/s3/backups/$1"; }
count() { find "$(bucket "$1")" -maxdepth 1 -name 'subs-*' 2> /dev/null | wc -l | tr -d ' '; }
has() { [[ -f "$(bucket "$1")/$2" ]]; }
put() { mkdir -p "$(bucket "$1")" && echo x > "$(bucket "$1")/$2"; }

run_backup() {
  docker run --rm --network "$net" \
    -e DB_HOST="$pg" -e DB_DATABASE=subs -e DB_USERNAME=subs -e DB_PASSWORD=secret \
    -e BACKUP_AGE_RECIPIENT="$recipient" \
    -e BACKUP_S3_PROVIDER=Other -e BACKUP_S3_ENDPOINT="http://$s3:9000" -e BACKUP_S3_REGION=us-east-1 \
    -e BACKUP_S3_BUCKET=backups -e BACKUP_S3_KEY=key -e BACKUP_S3_SECRET="${secret:-secret123}" \
    -v "$work/backups:/backups" -v "$work/status:/status" "$@" "$image" /usr/local/bin/backup.sh
}

status() { sed -n "s/.*\"$1\":\([^,}]*\).*/\1/p" "$work/status/status.json" | tr -d '"'; }

restore_args="--network $net -e DB_HOST=$pg -e DB_DATABASE=subs -e DB_USERNAME=subs -e DB_PASSWORD=secret -e BACKUP_S3_PROVIDER=Other -e BACKUP_S3_ENDPOINT=http://$s3:9000 -e BACKUP_S3_REGION=us-east-1 -e BACKUP_S3_BUCKET=backups -e BACKUP_S3_KEY=key -e BACKUP_S3_SECRET=secret123"

echo "== setup"
docker build -q -f "$repo/docker/prod/backup.Dockerfile" -t "$image" "$repo" > /dev/null || { echo "FAIL  image build"; exit 1; }
docker network create "$net" > /dev/null
docker run -d --name "$pg" --network "$net" -e POSTGRES_DB=subs -e POSTGRES_USER=subs -e POSTGRES_PASSWORD=secret postgres:18-alpine > /dev/null
mkdir -p "$work/s3/backups"
docker run -d --name "$s3" --network "$net" -v "$work/s3:/data" --entrypoint rclone "$image" serve s3 --auth-key key,secret123 --addr :9000 --dir-cache-time 0s /data > /dev/null
for _ in $(seq 1 30); do docker exec "$pg" pg_isready -U subs -d subs > /dev/null 2>&1 && break; sleep 1; done
sleep 3
docker exec "$pg" psql -U subs -d subs -qc "create table harness_rows(id int); insert into harness_rows values (1),(2),(3);"
mkdir -p "$work/backups" "$work/status" "$work/key"
docker run --rm -v "$work/key:/key" --entrypoint age-keygen "$image" -o /key/identity.txt 2> /dev/null
recipient="$(sed -n 's/^# public key: //p' "$work/key/identity.txt")"
[[ "$recipient" == age1* ]] || { echo "FAIL  age key"; exit 1; }

echo "== first backup"
run_backup > "$work/first.log" 2>&1; code=$?
check "exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/first.log" | tr '\n' ' '))"
check "one daily object" "$([[ $(count daily) == 1 ]]; echo $?)" "(found $(count daily))"
check "status ok" "$([[ $(status last_run_ok) == true ]]; echo $?)"
check "one local copy" "$([[ $(find "$work/backups" -name 'subs-*.dump.age' | wc -l | tr -d ' ') == 1 ]]; echo $?)"

echo "== retention (Sunday 2026-11-01, also the 1st)"
for d in $(seq -w 1 20); do put daily "subs-202610${d}T030000Z.dump.age"; done
for d in 04 11 18 25; do put weekly "subs-202610${d}T030000Z.dump.age"; done
put daily notes.txt
run_backup -e FAKE_NOW=2026-11-01T03:00:00Z > "$work/retention.log" 2>&1; code=$?
check "retention run exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/retention.log" | tr '\n' ' '))"
check "daily keeps 14" "$([[ $(count daily) == 14 ]]; echo $?)" "(found $(count daily))"
check "newest daily is today's" "$(has daily subs-20261101T030000Z.dump.age; echo $?)"
check "weekly has today's copy" "$(has weekly subs-20261101T030000Z.dump.age; echo $?)"
check "monthly has today's copy" "$(has monthly subs-20261101T030000Z.dump.age; echo $?)"
check "unrelated file untouched" "$(has daily notes.txt; echo $?)"

echo "== local copies"
run_backup -e FAKE_NOW=2026-11-02T03:00:00Z > /dev/null 2>&1
run_backup -e FAKE_NOW=2026-11-03T03:00:00Z > /dev/null 2>&1
check "local keeps 3" "$([[ $(find "$work/backups" -name 'subs-*.dump.age' | wc -l | tr -d ' ') == 3 ]]; echo $?)"

echo "== keep count 0 is refused"
before_zero="$(count daily)"
run_backup -e FAKE_NOW=2026-11-04T01:00:00Z -e BACKUP_KEEP_DAILY=0 > /dev/null 2>&1; code=$?
check "refuses keep 0" "$([[ $code != 0 ]]; echo $?)"
check "nothing deleted with keep 0" "$([[ $(count daily) -ge $before_zero ]]; echo $?)"

echo "== upload fails"
before_daily="$(count daily)"; before_success="$(status last_success_at)"
secret=wrong run_backup -e FAKE_NOW=2026-11-04T03:00:00Z > /dev/null 2>&1; code=$?
check "non-zero exit" "$([[ $code != 0 ]]; echo $?)"
check "status failed" "$([[ $(status last_run_ok) == false ]]; echo $?)"
check "last success unchanged" "$([[ $(status last_success_at) == "$before_success" ]]; echo $?)"
check "no new object" "$([[ $(count daily) == "$before_daily" ]]; echo $?)"
check "no partial files" "$([[ $(find "$work/backups" -name '*.partial' | wc -l | tr -d ' ') == 0 ]]; echo $?)"

echo "== restore"
newest="$(find "$(bucket daily)" -name 'subs-*.dump.age' -exec basename {} \; | sort -r | head -1)"
RESTORE_DOCKER_ARGS="$restore_args" RESTORE_IMAGE="$image" \
  bash "$repo/deploy/restore.sh" "daily/$newest" --yes < "$work/key/identity.txt" > "$work/restore.log" 2>&1; code=$?
check "restore exit 0" "$([[ $code == 0 ]]; echo $?)" "($(tail -3 "$work/restore.log" | tr '\n' ' '))"
check "restored rows" "$([[ $(docker exec "$pg" psql -U subs -d subs_restore -tAc 'select count(*) from harness_rows' 2> /dev/null) == 3 ]]; echo $?)"
check "source untouched" "$([[ $(docker exec "$pg" psql -U subs -d subs -tAc 'select count(*) from harness_rows') == 3 ]]; echo $?)"
bash "$repo/deploy/restore.sh" "../../etc/passwd" --yes < /dev/null > /dev/null 2>&1; code=$?
check "restore rejects a malformed object name" "$([[ $code == 2 ]]; echo $?)"
echo "not a key" | RESTORE_DOCKER_ARGS="$restore_args" RESTORE_IMAGE="$image" \
  bash "$repo/deploy/restore.sh" "daily/$newest" --yes > /dev/null 2>&1; code=$?
check "restore refuses a wrong key" "$([[ $code != 0 ]]; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
