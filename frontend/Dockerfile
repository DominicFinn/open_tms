# Frontend Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
# Create entrypoint script for runtime API URL override
RUN echo '#!/bin/sh' > /docker-entrypoint.d/99-envsubst.sh && \
    echo 'set -e' >> /docker-entrypoint.d/99-envsubst.sh && \
    echo 'VITE_API_URL="${VITE_API_URL:-http://localhost:3001}"' >> /docker-entrypoint.d/99-envsubst.sh && \
    echo 'find /usr/share/nginx/html -type f -name "*.js" -print0 | xargs -0 sed -i "s|http://localhost:3001|${VITE_API_URL}|g"' >> /docker-entrypoint.d/99-envsubst.sh && \
    chmod +x /docker-entrypoint.d/99-envsubst.sh
EXPOSE 80
