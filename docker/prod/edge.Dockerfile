# syntax=docker/dockerfile:1
FROM caddy:2-alpine
COPY docker/prod/Caddyfile /etc/caddy/Caddyfile
COPY landing/ /srv/landing/
COPY docker/prod/admin/ /srv/admin/
