# syntax=docker/dockerfile:1.6

# Stage 1 — Composer dependencies. Network + PHP work, no C compilation.
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
    composer dump-autoload --optimize --classmap-authoritative

# Stage 2 — ServerSideUp PHP base image.
#   https://serversideup.net/open-source/docker-php/
#   https://craftcms.com/knowledge-base/docker-in-production
# intl, gd, pdo_mysql, zip, opcache, curl, imagick, bcmath, redis, etc. are
# all already present: zero ext compilation on our side.
FROM serversideup/php:7.4-fpm-alpine AS runtime

USER root

ENV PHP_OPCACHE_ENABLE=true \
    PHP_MEMORY_LIMIT=512M \
    PHP_UPLOAD_MAX_FILESIZE=256M \
    PHP_POST_MAX_SIZE=256M \
    CRAFT_STREAM_LOG=true

WORKDIR /var/www/cms

COPY --chown=www-data:www-data cms/          /var/www/cms/
COPY --chown=www-data:www-data --from=vendor /app/vendor /var/www/cms/vendor
COPY --chown=www-data:www-data public_html/  /var/www/public_html/

RUN mkdir -p /var/www/cms/storage/logs \
             /var/www/cms/storage/runtime \
             /var/www/public_html/cpresources \
    && chown -R www-data:www-data /var/www/cms/storage /var/www/public_html/cpresources

USER www-data
