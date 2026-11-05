# syntax=docker/dockerfile:1
# pg_dump must match the server's major version (Postgres 18).
FROM postgres:18-alpine
RUN apk add --no-cache age rclone bash coreutils
COPY --chmod=755 deploy/backup/backup.sh /usr/local/bin/backup.sh
COPY deploy/backup/crontab /etc/crontabs/root
ENV TZ=UTC
ENTRYPOINT []
CMD ["crond", "-f", "-l", "8"]
