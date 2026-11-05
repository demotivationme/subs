#!/bin/sh
set -eu

# The storage mount starts empty on a new server.
mkdir -p storage/app/private/backups storage/app/public storage/framework/cache/data storage/framework/sessions \
  storage/framework/views storage/logs bootstrap/cache

# Each container has its own bootstrap/cache, so each long-running one builds its caches at start.
case "$*" in
  php-fpm*|"php artisan horizon"*|"php artisan schedule:work"*)
    php artisan config:cache
    php artisan route:cache
    php artisan event:cache
    ;;
esac

exec "$@"
