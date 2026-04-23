# syntax=docker/dockerfile:1.6

# Craft 3.7 runs on PHP 7.4 (EOL). The official docker.io/library/php 7.4 tags
# have been partially removed, so we use serversideup's maintained Alpine image.
# Docs: https://serversideup.net/open-source/docker-php/
FROM serversideup/php:7.4-fpm-alpine

USER root

# Add Craft's required/recommended PHP extensions that the base image doesn't
# ship. mlocati/php-extension-installer pulls prebuilt Alpine APK packages where
# possible, so this step is fast and doesn't compile anything on our machine.
#   - intl:    required by Craft (i18n, formatting)
#   - gd:      required for image transforms (Craft accepts gd OR imagick)
#   - imagick: preferred image driver (animated GIFs, better PNG handling)
#   - bcmath:  required by several Craft plugins (e.g. imager-x)
#   - exif:    metadata reading for image plugins
COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/install-php-extensions
RUN install-php-extensions intl gd imagick bcmath exif

ENV PHP_OPCACHE_ENABLE=true \
    PHP_MEMORY_LIMIT=512M \
    PHP_UPLOAD_MAX_FILESIZE=256M \
    PHP_POST_MAX_SIZE=256M

# Composer is already present in the base image at /usr/bin/composer. We do NOT
# bake the app or run `composer install` here — the host repo is bind-mounted at
# /var/www for fast local iteration (see docker-compose.yml).

WORKDIR /var/www/cms

USER www-data
