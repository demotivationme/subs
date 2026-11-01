#!/usr/bin/env bash
# Nightly: dump Postgres and upload to OVH Object Storage (S3-compatible, configured via `aws configure`).
set -Eeuo pipefail

# Prints KEY's value from a Compose-style .env without evaluating it as shell (passwords may
# hold `$ ; #` etc.). The last assignment wins; one pair of surrounding quotes is removed.
read_env_value() {
    local key=$1 file=$2 value
    value=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 | cut -d= -f2- | tr -d '\r' || true)
    if [[ ${#value} -ge 2 && ( ( $value == \"*\" ) || ( $value == \'*\' ) ) ]]; then
        value=${value:1:${#value}-2}
    fi
    printf '%s' "$value"
}

main() {
    # cron runs with a minimal PATH; docker, aws and gzip live in these.
    export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
    trap 'echo "backup.sh: FAILED (exit $?) running: $BASH_COMMAND" >&2' ERR

    cd "$(dirname "$0")/../.."

    # Root .env (also read by Docker Compose) may hold BACKUP_BUCKET / BACKUP_ENDPOINT;
    # values already in the environment win.
    if [ -f ./.env ]; then
        BACKUP_BUCKET=${BACKUP_BUCKET:-$(read_env_value BACKUP_BUCKET ./.env)}
        BACKUP_ENDPOINT=${BACKUP_ENDPOINT:-$(read_env_value BACKUP_ENDPOINT ./.env)}
    fi
    if [ -z "${BACKUP_BUCKET:-}" ] || [ -z "${BACKUP_ENDPOINT:-}" ]; then
        echo "backup.sh: FAILED: set BACKUP_BUCKET and BACKUP_ENDPOINT (root .env or environment)" >&2
        exit 1
    fi

    STAMP=$(date -u +%Y%m%dT%H%M%SZ)
    FILE="/tmp/subs-${STAMP}.sql.gz"
    trap 'rm -f "$FILE"' EXIT

    docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U subs subs | gzip > "$FILE"
    aws s3 cp "$FILE" "s3://${BACKUP_BUCKET}/postgres/" --endpoint-url "${BACKUP_ENDPOINT}"
}

# Sourcing the file (e.g. to test read_env_value) defines the functions without running a backup.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
