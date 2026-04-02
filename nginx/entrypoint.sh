#!/bin/sh
set -e
# Substitute ${NGINX_HOST} from the environment into the config template.
# Only this variable is passed to envsubst so that nginx runtime variables
# like $host, $uri, $scheme are left exactly as written in the template.
envsubst '${NGINX_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
