FROM python:3.12-slim

# System deps required by mysqlclient and python-magic
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    gcc \
    pkg-config \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# requirements/ lives at the repo root; build context is set to repo root in docker-compose
COPY requirements /requirements
RUN pip install --no-cache-dir -r /requirements/development.txt

COPY backend/ .

COPY backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
