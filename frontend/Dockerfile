FROM node:20-slim

WORKDIR /app

COPY frontend/package*.json ./

COPY frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 5173

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]