#!/bin/sh
# Substitui apenas API_UPSTREAM — deixa variáveis do Nginx ($uri, $host, etc.) intactas
envsubst '${API_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
