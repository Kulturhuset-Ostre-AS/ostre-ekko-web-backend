# syntax=docker/dockerfile:1.6

# Stage 1 — install Composer dependencies once, cached by composer.lock.
FROM composer:2 AS vendor

WORKDIR /app

COPY cms/composer.json cms/composer.lock* ./
RUN --mount=type=cache,target=/tmp/composer \
    COMPOSER_CACHE_DIR=/tmp/composer \
    composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --no-interaction \
        --prefer-dist

COPY cms/ ./
RUN --mount=type=cache,target=/tmp/composer \
    COMPOSER_CACHE_DIR=/tmp/composer \
    composer dump-autoload \
        --optimize \
        --classmap-authoritative

# Stage 2 — php-fpm with prebuilt extensions and the app baked in.
FROM php:7.4-fpm-bullseye AS runtime

# install-php-extensions is the maintained community tool; it pulls prebuilt
# binaries where available and handles system deps for us.
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN install-php-extensions \
        intl \
        pdo_mysql \
        zip \
        opcache \
        gd \
        curl

RUN printf 'memory_limit=512M\nupload_max_filesize=256M\npost_max_size=256M\nopcache.enable=1\nopcache.jit=off\n' \
    > /usr/local/etc/php/conf.d/zz-ekko.ini

WORKDIR /var/www/cms

# App code + vendor. Runtime-writable paths are redeclared as VOLUMEs below
# so Compose can wire them to named volumes / host paths without masking the
# rest of the image.
COPY --chown=www-data:www-data cms/ /var/www/cms/
COPY --chown=www-data:www-data --from=vendor /app/vendor /var/www/cms/vendor
COPY --chown=www-data:www-data public_html/ /var/www/public_html/

RUN mkdir -p /var/www/cms/storage/logs \
             /var/www/cms/storage/runtime \
             /var/www/public_html/cpresources \
    && chown -R www-data:www-data /var/www/cms/storage /var/www/public_html/cpresources

USER www-data
