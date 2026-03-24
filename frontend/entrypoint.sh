#!/bin/sh
set -e
if [ ! -f "node_modules/.package-lock.json" ]; then
  echo "node_modules not found, running npm ci..."
  npm ci
fi
exec "$@"