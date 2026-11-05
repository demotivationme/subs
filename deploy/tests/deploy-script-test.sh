#!/usr/bin/env bash
# shellcheck disable=SC2319 # each check passes the status of its own test on purpose
# Tests deploy.sh's decisions with fake docker/curl (no containers). Usage: bash deploy/tests/deploy-script-test.sh
set -uo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
check() { if [[ "$2" == 0 ]]; then echo "PASS  $1"; else echo "FAIL  $1"; failures=$((failures + 1)); fi; }

mkdir -p "$work/bin" "$work/srv"
cp "$repo/deploy/deploy.sh" "$work/srv/"
touch "$work/srv/compose.prod.yaml" "$work/backup-tags" "$work/bad-migrate-tags" "$work/healthy-tags"

# Fake docker: `up -d … app …` makes TAG the running one; migrate fails for tags in bad-migrate-tags; the backup
# image only exists for tags in backup-tags. Every call is logged to $WORK/calls.
cat > "$work/bin/docker" << 'FAKE'
#!/usr/bin/env bash
echo "TAG=${TAG:-} docker $*" >> "$WORK/calls"
if [[ "$*" == *"artisan migrate"* ]] && grep -qx "${TAG:-}" "$WORK/bad-migrate-tags"; then echo "migration failed" >&2; exit 1; fi
if [[ "$*" == *" up -d"* && "$*" == *backup* ]] && ! grep -qx "${TAG:-}" "$WORK/backup-tags"; then
  echo "pull access denied for subs-backup:${TAG:-}" >&2; exit 1
fi
if [[ "$*" == *" up -d"* && "$*" == *" app"* ]]; then echo "${TAG:-}" > "$WORK/running"; fi
exit 0
FAKE
# Fake curl: healthy only when the running tag is in healthy-tags; logs each call.
cat > "$work/bin/curl" << 'FAKE'
#!/usr/bin/env bash
echo "curl $*" >> "$WORK/calls"
grep -qx "$(cat "$WORK/running" 2> /dev/null)" "$WORK/healthy-tags"
FAKE
chmod +x "$work/bin/docker" "$work/bin/curl"
export PATH="$work/bin:$PATH" WORK="$work" HEALTH_TRIES=2 HEALTH_SLEEP=0
reset() { : > "$work/calls"; }

echo "== first deploy, healthy"
reset; printf 'v1\n' > "$work/healthy-tags"; printf 'v1\n' > "$work/backup-tags"
bash "$work/srv/deploy.sh" v1 > "$work/out" 2>&1; code=$?
check "succeeds" "$([[ $code == 0 ]]; echo $?)"
check "current-tag written" "$([[ $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"
check "never compose down" "$(! grep -q ' down' "$work/calls"; echo $?)"
check "never removes volumes" "$(! grep -qE ' -v( |$)|--volumes' "$work/calls"; echo $?)"
check "migrates before starting app" "$([[ $(grep -n 'artisan migrate' "$work/calls" | head -1 | cut -d: -f1) -lt $(grep -n ' up -d .* app' "$work/calls" | head -1 | cut -d: -f1) ]]; echo $?)"
check "heartbeat before health check" "$([[ $(grep -n 'reminders:dispatch' "$work/calls" | head -1 | cut -d: -f1) -lt $(grep -n '^curl' "$work/calls" | head -1 | cut -d: -f1) ]]; echo $?)"
check "seeds the catalog" "$(grep -q 'db:seed --class=CatalogSeeder --force' "$work/calls"; echo $?)"
check "checks api and landing on 8443" "$(grep -q 'api.unsab.com:8443:127.0.0.1' "$work/calls" && grep -q 'unsab.com:8443:127.0.0.1 https://unsab.com:8443/' "$work/calls"; echo $?)"

echo "== failed migration starts nothing"
reset; printf 'v2\n' > "$work/bad-migrate-tags"
bash "$work/srv/deploy.sh" v2 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "no service restarted" "$(! grep -q ' up -d .* app' "$work/calls"; echo $?)"
check "v1 still live" "$([[ $(cat "$work/running") == v1 && $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"

echo "== unhealthy release rolls back"
reset; : > "$work/bad-migrate-tags"
bash "$work/srv/deploy.sh" v3 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "v1 running again" "$([[ $(cat "$work/running") == v1 ]]; echo $?)"
check "current-tag unchanged" "$([[ $(cat "$work/srv/current-tag") == v1 ]]; echo $?)"
check "rollback reported" "$(grep -q 'Rolling back to v1' "$work/out"; echo $?)"

echo "== missing backup image only warns"
reset; printf 'v1\nv4\n' > "$work/healthy-tags"
bash "$work/srv/deploy.sh" v4 > "$work/out" 2>&1; code=$?
check "succeeds" "$([[ $code == 0 ]]; echo $?)"
check "backup problem reported" "$(grep -qi 'backup' "$work/out"; echo $?)"

echo "== first deploy unhealthy, nothing to roll back to"
reset; rm -f "$work/srv/current-tag" "$work/running"
bash "$work/srv/deploy.sh" v5 > "$work/out" 2>&1; code=$?
check "fails" "$([[ $code != 0 ]]; echo $?)"
check "no rollback attempted" "$(! grep -q 'Rolling back' "$work/out"; echo $?)"

echo "== unsafe tag refused"
reset
bash "$work/srv/deploy.sh" 'x;touch pwned' > "$work/out" 2>&1; code=$?
check "exit 2" "$([[ $code == 2 ]]; echo $?)"
check "nothing ran" "$([[ ! -s "$work/calls" ]]; echo $?)"

echo
if [[ $failures == 0 ]]; then echo "ALL PASS"; else echo "$failures FAILED"; exit 1; fi
