#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma migrate deploy..."
  if npx prisma migrate deploy; then
    echo "✅ Migrations applied successfully"
  else
    echo "❌ Migration failed - container will not start"
    exit 1
  fi
fi
exec "$@"
