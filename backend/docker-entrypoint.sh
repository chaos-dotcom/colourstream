#!/bin/sh
set -e

echo "Checking database..."

# Use db push instead of migrations
echo "Pushing database schema..."
npx prisma db push --force-reset

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