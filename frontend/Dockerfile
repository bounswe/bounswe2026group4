FROM node:20-slim

WORKDIR /app

# Copy lockfile + manifest first for layer caching
COPY frontend/package*.json ./

# Reproducible install using package-lock.json
RUN npm ci

COPY frontend/ .

COPY frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]