# syntax=docker/dockerfile:1.6
FROM nginx:1.25-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY public_html/ /var/www/public_html/
