#!/bin/sh
set -e

# Run migrations if DATABASE_URL is set (uses shared schema from backend)
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema=./prisma-schema/schema.prisma 2>/dev/null || true
fi

exec "$@"
