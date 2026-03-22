#!/bin/sh
python manage.py migrate --noinput
exec "$@"
