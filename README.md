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

## Expo Go mobile development

For Expo Go on a physical phone, set `mobile/.env` so the app points to your computer's LAN IP instead of `localhost`:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
EXPO_PUBLIC_ENV=development
```

Then start Django on all interfaces:

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

The development settings now accept LAN hosts by default, which makes local Expo Go testing work without editing `ALLOWED_HOSTS` every time your IP changes.

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
