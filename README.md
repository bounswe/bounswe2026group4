# Local History Story Map

A platform for discovering and contributing location-based community stories through a map and feed interface.

**Live:** https://storymap.page

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django REST Framework + Gunicorn |
| Frontend | React + Vite |
| Mobile | Expo (React Native) |
| Database | MySQL 8.0 |
| Reverse proxy | nginx |
| Infrastructure | Docker Compose |

---

## Development

### Prerequisites

Install Docker:
- **Windows / macOS** — [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux** — `curl -fsSL https://get.docker.com | sh`

### Setup

```bash
cp .env.example .env  # Windows CMD: use 'copy' instead of 'cp'
```

Open `.env` and fill in the values (at minimum `SECRET_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`).

### Run

```bash
docker compose up --build   # first time
docker compose up           # subsequent runs
```

| Service | URL |
|---------|-----|
| API | http://localhost:8000 |
| Frontend | http://localhost:5173 |

### Stop

```bash
docker compose down
```

### Tests

```bash
# Full test suite
docker compose run --rm --entrypoint="" web sh -c "pytest -v"

# Single app
docker compose run --rm --entrypoint="" web sh -c "pytest apps/users/tests/ -v"

# Single file
docker compose run --rm --entrypoint="" web sh -c "pytest apps/users/tests/test_models.py -v"
```

### Migrations

Migrations run automatically on startup. After adding or changing a model:

```bash
docker compose exec web python manage.py makemigrations
```

### Common commands

```bash
# Shell inside the backend container
docker compose exec web bash

# Reset database (wipes all data, keeps schema)
docker compose exec web python manage.py flush --noinput

# Wipe database volume entirely and reinitialise
docker compose down -v && docker compose up
```

---

## Production Deployment

### Server prerequisites

- Ubuntu 24.04 VPS (1 GB RAM minimum — 2 GB swap required, see below)
- A domain with an A record pointing to the server IP
- Ports 80 and 443 open

### One-time server setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Certbot
apt install -y certbot

# Add 2 GB swap (required — npm build OOMs on 1 GB RAM without it)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Clone the repo

```bash
cd /opt
git clone https://github.com/bounswe/bounswe2026group4.git
cd bounswe2026group4
```

### SSL certificate

```bash
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

mkdir -p nginx/certs
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/certs/
chmod 644 nginx/certs/*.pem
```

### Environment file

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Fill in all values. The fields that must match your domain:

```
ALLOWED_HOSTS=yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
VITE_API_URL=https://yourdomain.com/api
NGINX_HOST=yourdomain.com
```

Generate a secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### Build and start

```bash
set -a && source .env.prod && set +a
docker compose -f docker-compose.prod.yml up -d --build
```

### Verify

```bash
curl -I https://yourdomain.com          # → 200 OK
curl https://yourdomain.com/api/stories/ # → JSON
```

---

## Production Operations

### Check status

```bash
docker compose -f docker-compose.prod.yml ps
```

### View logs

```bash
docker compose -f docker-compose.prod.yml logs nginx --tail 50
docker compose -f docker-compose.prod.yml logs web --tail 50
docker compose -f docker-compose.prod.yml logs db --tail 50
```

### Update after a merge to main

```bash
cd /opt/bounswe2026group4
git pull origin main
set -a && source .env.prod && set +a
docker compose -f docker-compose.prod.yml up -d --build
```

> Deployments are also automated via the CD pipeline — merging to `main` triggers a GitHub Actions workflow that runs the above steps automatically.

### Stop / restart

```bash
# Stop all containers
docker compose -f docker-compose.prod.yml down

# Restart a single service
docker compose -f docker-compose.prod.yml restart web
```

### Reset database (wipes all data)

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py flush --noinput
```
