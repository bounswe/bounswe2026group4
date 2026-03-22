#!/bin/sh
# Grants the app user permission to create and manage test databases.
# Django's test runner creates `test_<DB_NAME>` automatically — it needs CREATE DATABASE.
# The primary DB is created automatically via MYSQL_DATABASE env var.
# This script runs once on first container initialization.
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
    GRANT ALL PRIVILEGES ON \`test_%\`.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
EOSQL
