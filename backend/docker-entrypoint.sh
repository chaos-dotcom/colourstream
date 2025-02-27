#!/bin/sh
set -e

# Configuration
DB_HOST="colourstream-postgres"
DB_PORT="5432"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "Starting backend initialization..."
echo "Database configuration:"
echo "- Host: $DB_HOST"
echo "- Port: $DB_PORT"
echo "- User: $POSTGRES_USER"
echo "- Database: $POSTGRES_DB"

# Function to check if PostgreSQL is ready
check_postgres() {
  PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d postgres -c "SELECT 1" > /dev/null 2>&1
}

# Function to check if our database exists
check_database_exists() {
  PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'" | grep -q 1
}

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
  echo "Attempting to connect to PostgreSQL at $DB_HOST:$DB_PORT (attempt $i/$MAX_RETRIES)..."
  if check_postgres; then
    echo "PostgreSQL is ready!"
    
    # Drop the database if it exists and recreate it
    if check_database_exists; then
      echo "Database $POSTGRES_DB exists, dropping it..."
      PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d postgres -c "DROP DATABASE $POSTGRES_DB;"
      if [ $? -ne 0 ]; then
        echo "Failed to drop database $POSTGRES_DB"
        exit 1
      fi
      echo "Database $POSTGRES_DB dropped successfully"
    fi
    
    echo "Creating database $POSTGRES_DB..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d postgres -c "CREATE DATABASE $POSTGRES_DB;"
    if [ $? -ne 0 ]; then
      echo "Failed to create database $POSTGRES_DB"
      exit 1
    fi
    echo "Database $POSTGRES_DB created successfully"
    
    break
  fi
  echo "Waiting for PostgreSQL... ($i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

if [ "$i" = "$MAX_RETRIES" ]; then
  echo "PostgreSQL is not available after $MAX_RETRIES attempts, exiting..."
  exit 1
fi

echo "Setting up database..."

# Install PostgreSQL extensions
echo "Installing PostgreSQL extensions..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d $POSTGRES_DB -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
if [ $? -ne 0 ]; then
  echo "Failed to install pgcrypto extension"
  exit 1
fi

PGPASSWORD=$POSTGRES_PASSWORD psql -h $DB_HOST -U $POSTGRES_USER -p $DB_PORT -d $POSTGRES_DB -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
if [ $? -ne 0 ]; then
  echo "Failed to install uuid-ossp extension"
  exit 1
fi
echo "PostgreSQL extensions installed successfully"

# Use db push instead of migrations - skip generating client
echo "Pushing schema to database..."
npx prisma db push --accept-data-loss --skip-generate
if [ $? -ne 0 ]; then
  echo "Failed to push schema to database"
  exit 1
fi
echo "Schema pushed to database successfully"

# Start the application
echo "Starting the application..."
exec node --trace-warnings dist/index.js 