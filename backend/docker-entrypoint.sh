#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
# Wait for PostgreSQL to be ready
for i in $(seq 1 30); do
  if nc -z postgres 5432; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

if [ "$i" = "30" ]; then
  echo "PostgreSQL is not available, exiting..."
  exit 1
fi

echo "Setting up database..."

# Install PostgreSQL extensions
echo "Installing PostgreSQL extensions..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U $POSTGRES_USER -d $POSTGRES_DB -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS uuid-ossp;"

# Use migrations for initial setup
echo "Running database migrations..."
npx prisma migrate deploy

# Create default OBS settings if they don't exist
echo "Creating default OBS settings..."
# Use a simpler approach with a direct database query
cat > create-obs-settings.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDefaultOBSSettings() {
  try {
    const existingSettings = await prisma.obssettings.findUnique({
      where: { id: 'default' }
    });
    
    if (!existingSettings) {
      await prisma.obssettings.create({
        data: {
          id: 'default',
          host: 'localhost',
          port: 4455,
          enabled: false,
          streamType: 'rtmp_custom',
          protocol: 'rtmp',
          useLocalNetwork: true,
          localNetworkMode: 'frontend',
          localNetworkHost: 'localhost',
          localNetworkPort: 4455
        }
      });
      console.log('Default OBS settings created successfully');
    } else {
      console.log('Default OBS settings already exist');
    }
  } catch (error) {
    console.error('Error creating default OBS settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultOBSSettings();
EOF

node create-obs-settings.js

# Ensure the Prisma client is up to date
echo "Generating Prisma client..."
npx prisma generate

# Start the application
echo "Starting application..."
node --trace-warnings dist/index.js 