# bounswe2026group4
CMPE354 Group 4 repository

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Setup

```bash
cp .env.example .env
```

Open `.env` and fill in the values (at minimum set a strong `SECRET_KEY`, `DB_PASSWORD`, and `DB_ROOT_PASSWORD`).

## Running the project

```bash
docker compose up --build
```

On subsequent runs:

```bash
docker compose up
```

The API will be available at `http://localhost:8000`.
The frontend will be available at `http://localhost:5173`.

To stop:

```bash
docker compose down
```

## Running tests

```bash
docker compose exec web pytest -v
```

Single test file:

```bash
docker compose exec web pytest apps/users/tests/test_models.py -v
```

## Applying migrations

Migrations run automatically on startup. After adding a new model, generate the migration file and commit it:

```bash
docker compose exec web python manage.py makemigrations
```

## Common commands

```bash
# Open a shell inside the container
docker compose exec web bash

# Wipe the database and start fresh
docker compose down -v
docker compose up
```
