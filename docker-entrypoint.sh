#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL to accept connections..."
ATTEMPTS=0
until node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge 60 ]; then
    echo "❌ PostgreSQL did not become ready in time." >&2
    exit 1
  fi
  sleep 2
done
echo "✅ PostgreSQL is ready."

echo "📦 Applying database schema with drizzle-kit push..."
npx drizzle-kit push --force || true

echo "🚀 Starting application..."
exec "$@"
