# syntax=docker/dockerfile:1
FROM php:8.5-fpm-alpine AS base
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_pgsql redis intl zip bcmath pcntl gmp opcache
COPY docker/prod/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/prod/php-fpm-pool.conf /usr/local/etc/php-fpm.d/zz-subs.conf
ENV PHP_FPM_MAX_CHILDREN=20
WORKDIR /var/www/html

FROM base AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --no-autoloader --prefer-dist

FROM base AS app
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY --from=vendor /var/www/html/vendor ./vendor
COPY backend/ ./
RUN composer dump-autoload --no-dev --classmap-authoritative --optimize \
    && php artisan package:discover --ansi \
    && rm /usr/local/bin/composer \
    && chown -R www-data:www-data storage bootstrap/cache
COPY --chmod=755 docker/prod/entrypoint.sh /usr/local/bin/entrypoint
USER www-data
ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

FROM nginx:1-alpine AS nginx
COPY docker/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY backend/public /var/www/html/public
