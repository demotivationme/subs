FROM php:8.5-fpm-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libicu-dev libgmp-dev libzip-dev \
        libpng-dev libjpeg-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install gd pdo_pgsql intl gmp pcntl zip bcmath \
    && pecl install redis && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend
