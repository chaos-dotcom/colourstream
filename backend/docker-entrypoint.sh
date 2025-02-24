#!/bin/sh
set -e

echo "Checking database..."

# Always run migrations to ensure schema is up to date
echo "Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client if needed
echo "Ensuring Prisma client is up to date..."
npx prisma generate

# Start the application
echo "Starting the application..."
exec npm start 