#!/bin/bash

# ColourStream GHCR Setup Script
# This script downloads and sets up ColourStream using GitHub Container Registry images

echo "ColourStream GHCR Setup"
echo "======================"
echo

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required commands
echo "Checking dependencies..."
for cmd in docker docker-compose curl git openssl; do
  if ! command_exists $cmd; then
    echo "Error: $cmd is not installed."
    echo "Please install $cmd and run this script again."
    exit 1
  fi
done
echo "All dependencies found."
echo

# Clean any stale docker-compose.yml
if [ -f "docker-compose.yml" ]; then
  echo "Removing existing docker-compose.yml..."
  rm docker-compose.yml
fi

# Create directories
echo "Creating required directories..."
mkdir -p backend/logs backend/uploads backend/prisma postgres traefik certs/certs certs/private ovenmediaengine/origin_conf ovenmediaengine/edge_conf coturn mirotalk

# Function to prompt for domain name
get_domain() {
  read -p "Enter your domain name (e.g., example.com): " domain_name
  if [ -z "$domain_name" ]; then
    echo "Domain name cannot be empty. Please try again."
    get_domain
  fi
  echo $domain_name
}

# Function to prompt for admin email
get_admin_email() {
  read -p "Enter admin email address: " admin_email
  if [ -z "$admin_email" ]; then
    echo "Admin email cannot be empty. Please try again."
    get_admin_email
  fi
  echo $admin_email
}

# Function to generate a random password
generate_password() {
  openssl rand -hex 16
}

# Get user input
domain_name=$(get_domain)
admin_email=$(get_admin_email)

# Generate random passwords
db_password=$(generate_password)
jwt_key=$(generate_password)
admin_password=$(generate_password)
admin_auth_secret=$(generate_password)
mirotalk_api_key=$(generate_password)
turn_password=$(generate_password)
ome_api_token=$(generate_password)

echo
echo "Downloading files from GitHub repository..."

# Download docker-compose template and rename it
echo "Downloading docker-compose template..."
curl -s https://raw.githubusercontent.com/johnr24/colourstream/main/docker-compose.template.yml > docker-compose.yml
echo "✅ Downloaded docker-compose.yml"

# Download PostgreSQL configuration
echo "Downloading PostgreSQL configuration..."
curl -s https://raw.githubusercontent.com/johnr24/colourstream/main/postgres/postgresql.conf > postgres/postgresql.conf
echo "✅ Downloaded postgresql.conf"

# Create empty acme.json for Traefik and set permissions
touch traefik/acme.json
chmod 600 traefik/acme.json
echo "✅ Created Traefik acme.json"

# Create global.env
echo "Creating global.env..."
cat > global.env << EOL
# Global Environment Variables
DOMAIN=${domain_name}
ADMIN_EMAIL=${admin_email}

# Database Credentials
DB_HOST=colourstream-postgres
DB_PORT=5432
DB_USER=colourstream
DB_PASSWORD=${db_password}
DB_NAME=colourstream

# Security
JWT_KEY=${jwt_key}
ADMIN_AUTH_SECRET=${admin_auth_secret}
ADMIN_PASSWORD=${admin_password}

# MiroTalk Configuration
MIROTALK_API_KEY=${mirotalk_api_key}
MIROTALK_USERNAME=admin
MIROTALK_PASSWORD=${admin_password}

# TURN Server
TURN_SERVER_ENABLED=true
TURN_SERVER_USERNAME=colourstream
TURN_SERVER_CREDENTIAL=${turn_password}

# OvenMediaEngine
OME_API_ACCESS_TOKEN=${ome_api_token}
EOL
chmod 600 global.env
echo "✅ Created global.env"

# Create backend/.env
echo "Creating backend/.env..."
cat > backend/.env << EOL
# Backend Environment Variables
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://colourstream:${db_password}@colourstream-postgres:5432/colourstream
JWT_KEY=${jwt_key}
ADMIN_AUTH_SECRET=${admin_auth_secret}
ADMIN_PASSWORD=${admin_password}
WEBAUTHN_RP_ID=live.colourstream.${domain_name}
WEBAUTHN_ORIGIN=https://live.colourstream.${domain_name}
DOMAIN=${domain_name}
VIDEO_DOMAIN=video.colourstream.${domain_name}
FRONTEND_URL=https://live.colourstream.${domain_name}
BASE_PATH=/api
OME_API_ACCESS_TOKEN=${ome_api_token}
OME_API_URL=http://origin:8081
EOL
chmod 600 backend/.env
echo "✅ Created backend/.env"

# Create frontend/.env
echo "Creating frontend/.env..."
cat > frontend/.env << EOL
# Frontend Environment Variables
VITE_API_URL=https://live.colourstream.${domain_name}/api
VITE_WEBRTC_WS_HOST=live.colourstream.${domain_name}
VITE_WEBRTC_WS_PORT=3334
VITE_WEBRTC_WS_PROTOCOL=wss
VITE_WEBRTC_APP_PATH=app
VITE_VIDEO_URL=https://video.colourstream.${domain_name}/join
VITE_OVENPLAYER_SCRIPT_URL=https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.js
EOL
chmod 600 frontend/.env
echo "✅ Created frontend/.env"

# Create mirotalk/.env
echo "Creating mirotalk/.env..."
cat > mirotalk/.env << EOL
# Mirotalk P2P Environment Variables
FRONTEND_URL=https://live.colourstream.${domain_name}
TURN_SERVER_ENABLED=true
TURN_SERVER_URL=turn:video.colourstream.${domain_name}:3480
TURN_SERVER_USERNAME=colourstream
TURN_SERVER_CREDENTIAL=${turn_password}
API_KEY_SECRET=${mirotalk_api_key}
NODE_ENV=production
JWT_KEY=${jwt_key}
HOST_PROTECTED=true
HOST_USERNAME=admin
HOST_PASSWORD=${admin_password}
EOL
chmod 600 mirotalk/.env
echo "✅ Created mirotalk/.env"

# Create coturn configuration
echo "Creating TURN server configuration..."
cat > coturn/turnserver.conf << EOL
# TURN server configuration
listening-port=3480
fingerprint
lt-cred-mech
user=colourstream:${turn_password}
realm=video.colourstream.${domain_name}
cert=/certs/video.colourstream.${domain_name}.crt
pkey=/certs/video.colourstream.${domain_name}.key
no-multicast-peers
no-cli
no-tcp-relay
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
syslog
EOL
echo "✅ Created TURN server configuration"

# Replace domains in docker-compose.yml
echo "Updating docker-compose.yml with your domain..."
sed -i.bak "s/example.com/${domain_name}/g" docker-compose.yml
sed -i.bak "s/admin@example.com/${admin_email}/g" docker-compose.yml
sed -i.bak "s/628db0ebd5d8c8fc4f539e7192fa6ff1/${db_password}/g" docker-compose.yml
sed -i.bak "s/015a8afab726389330e5002945d9d27a7de31bc813/${jwt_key}/g" docker-compose.yml
sed -i.bak "s/a4097b976531c94f5e4cf9d2676751c7/${admin_auth_secret}/g" docker-compose.yml
sed -i.bak "s/0fc62ea62790ad7c/${ome_api_token}/g" docker-compose.yml
sed -i.bak "s/41b20d4a33dcca381396b5b83053ef2f/${ome_api_token}/g" docker-compose.yml
sed -i.bak "s/OME_API_ACCESS_TOKEN: \"[a-f0-9]*\"/OME_API_ACCESS_TOKEN: \"${ome_api_token}\"/g" docker-compose.yml
sed -i.bak "s/turnserver123/${turn_password}/g" docker-compose.yml
rm docker-compose.yml.bak
echo "✅ Updated docker-compose.yml"

# Create reference file for credentials
echo "Creating credentials reference file..."
cat > env.reference << EOL
# Generated Configuration - $(date)
# THIS IS A REFERENCE FILE ONLY - NOT USED BY THE APPLICATION
# Keep this file secure as it contains sensitive credentials

DOMAIN_NAME=${domain_name}
ADMIN_EMAIL=${admin_email}
DB_PASSWORD=${db_password}
JWT_KEY=${jwt_key}
ADMIN_PASSWORD=${admin_password}
ADMIN_AUTH_SECRET=${admin_auth_secret}
MIROTALK_API_KEY=${mirotalk_api_key}
TURN_PASSWORD=${turn_password}
OME_API_TOKEN=${ome_api_token}
FRONTEND_URL=https://live.colourstream.${domain_name}
VIDEO_URL=https://video.colourstream.${domain_name}
EOL
chmod 600 env.reference
echo "✅ Created credentials reference file"

echo
echo "Setup completed successfully!"
echo
echo "Next steps:"
echo "1. Configure DNS records for:"
echo "   - live.colourstream.${domain_name}"
echo "   - video.colourstream.${domain_name}"
echo "2. Start the application with: docker-compose up -d"
echo "3. Traefik will automatically obtain SSL certificates"
echo
echo "Admin credentials:"
echo "Username: admin"
echo "Password: ${admin_password}"
echo
echo "All credentials have been saved to env.reference for your reference."
echo "IMPORTANT: Keep this file secure as it contains sensitive information!" 