# Stub App — Root Dockerfile
# Serves the full stub app (all static files) with nginx.

FROM nginx:alpine

# Copy all static files into nginx web root
COPY . /usr/share/nginx/html

# Remove the Dockerfile itself from the served directory
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/.git

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
