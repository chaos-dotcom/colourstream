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

# Function to check if environment is already configured
check_configured() {
  if [ -f "global.env" ]; then
    # Extract domain from global.env
    if grep -q "DOMAIN=" global.env; then
      configured_domain=$(grep "DOMAIN=" global.env | cut -d'=' -f2)
      # Strip any 'live.colourstream.' or 'video.colourstream.' prefix
      configured_domain=$(echo "$configured_domain" | sed -e 's/^live\.colourstream\.//' -e 's/^video\.colourstream\.//')
      echo "Found existing configuration for domain: $configured_domain"
      return 0
    fi
  fi
  return 1
}

# Function to prompt for domain name
get_domain() {
  read -p "Enter your domain name (e.g., example.com): " domain_name
  if [ -z "$domain_name" ]; then
    echo "Domain name cannot be empty. Please try again."
    get_domain
  fi
  # Clean the domain name to ensure no newlines or extra spaces
  domain_name=$(echo "$domain_name" | tr -d '\n\r' | xargs)
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

# Function to rotate secrets only
rotate_secrets() {
  echo "Rotating secrets for existing installation..."
  
  # Extract current domain and email
  domain_name=$(grep "DOMAIN=" global.env | cut -d'=' -f2)
  # Strip any 'live.colourstream.' or 'video.colourstream.' prefix
  domain_name=$(echo "$domain_name" | sed -e 's/^live\.colourstream\.//' -e 's/^video\.colourstream\.//')
  # Clean the domain name to ensure no newlines or extra spaces
  domain_name=$(echo "$domain_name" | tr -d '\n\r' | xargs)
  admin_email=$(grep "ADMIN_EMAIL=" global.env | cut -d'=' -f2)
  
  echo "Domain: $domain_name"
  echo "Admin Email: $admin_email"
  
  # Generate new passwords
  db_password=$(generate_password)
  jwt_key=$(generate_password)
  jwt_secret=$(generate_password)  # Generate separate JWT_SECRET
  admin_password=$(generate_password)
  admin_auth_secret=$(generate_password)
  mirotalk_api_key=$(generate_password)
  turn_password=$(generate_password)
  ome_api_token=$(generate_password)
  ome_webhook_secret=$(generate_password)
  
  echo "Updating configuration files with new secrets..."
  
  # Update global.env with new secrets
  sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=${db_password}/g" global.env
  sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${db_password}/g" global.env
  sed -i.bak "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" global.env
  sed -i.bak "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${admin_password}/g" global.env
  sed -i.bak "s/ADMIN_AUTH_SECRET=.*/ADMIN_AUTH_SECRET=${admin_auth_secret}/g" global.env
  sed -i.bak "s/MIROTALK_API_KEY=.*/MIROTALK_API_KEY=${mirotalk_api_key}/g" global.env
  sed -i.bak "s/MIROTALK_API_KEY_SECRET=.*/MIROTALK_API_KEY_SECRET=${mirotalk_api_key}/g" global.env
  sed -i.bak "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=${turn_password}/g" global.env
  sed -i.bak "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=${ome_api_token}/g" global.env
  sed -i.bak "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=${ome_webhook_secret}/g" global.env
  
  # Update backend/.env with new secrets
  sed -i.bak "s/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/colourstream:${db_password}@colourstream-postgres:5432\/colourstream/g" backend/.env
  sed -i.bak "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" backend/.env
  sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/g" backend/.env
  sed -i.bak "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${admin_password}/g" backend/.env
  sed -i.bak "s/ADMIN_AUTH_SECRET=.*/ADMIN_AUTH_SECRET=${admin_auth_secret}/g" backend/.env
  sed -i.bak "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=${ome_api_token}/g" backend/.env
  sed -i.bak "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=${ome_webhook_secret}/g" backend/.env
  
  # Update mirotalk/.env with new secrets
  sed -i.bak "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=${turn_password}/g" mirotalk/.env
  sed -i.bak "s/API_KEY_SECRET=.*/API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
  sed -i.bak "s/MIROTALK_API_KEY_SECRET=.*/MIROTALK_API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
  sed -i.bak "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" mirotalk/.env
  sed -i.bak "s/HOST_PASSWORD=.*/HOST_PASSWORD=${admin_password}/g" mirotalk/.env
  
  # Update coturn config
  sed -i.bak "s/user=colourstream:.*/user=colourstream:${turn_password}/g" coturn/turnserver.conf
  
  # Update docker-compose.yml
  sed -i.bak "s/POSTGRES_PASSWORD: \"[^\"]*\"/POSTGRES_PASSWORD: \"${db_password}\"/g" docker-compose.yml
  sed -i.bak "s/DATABASE_URL: \"postgresql:\/\/colourstream:.*@colourstream-postgres/DATABASE_URL: \"postgresql:\/\/colourstream:${db_password}@colourstream-postgres/g" docker-compose.yml
  sed -i.bak "s/JWT_KEY: \"[^\"]*\"/JWT_KEY: \"${jwt_key}\"/g" docker-compose.yml
  sed -i.bak "s/JWT_SECRET: \"[^\"]*\"/JWT_SECRET: \"${jwt_secret}\"/g" docker-compose.yml
  sed -i.bak "s/ADMIN_AUTH_SECRET: \"[^\"]*\"/ADMIN_AUTH_SECRET: \"${admin_auth_secret}\"/g" docker-compose.yml
  sed -i.bak "s/OME_API_ACCESS_TOKEN: \"[^\"]*\"/OME_API_ACCESS_TOKEN: \"${ome_api_token}\"/g" docker-compose.yml
  sed -i.bak "s/OME_WEBHOOK_SECRET: \"[^\"]*\"/OME_WEBHOOK_SECRET: \"${ome_webhook_secret}\"/g" docker-compose.yml
  sed -i.bak "s/TURN_SERVER_CREDENTIAL: \"[^\"]*\"/TURN_SERVER_CREDENTIAL: \"${turn_password}\"/g" docker-compose.yml
  sed -i.bak "s/MIROTALK_API_KEY: \"[^\"]*\"/MIROTALK_API_KEY: \"${mirotalk_api_key}\"/g" docker-compose.yml
  sed -i.bak "s/MIROTALK_API_KEY_SECRET: \"[^\"]*\"/MIROTALK_API_KEY_SECRET: \"${mirotalk_api_key}\"/g" docker-compose.yml
  
  # Clean up backup files
  find . -name "*.bak" -type f -delete
  
  # Create/update reference file for credentials
  echo "Creating credentials reference file..."
  cat > env.reference << EOL
# Generated Configuration - $(date)
# THIS IS A REFERENCE FILE ONLY - NOT USED BY THE APPLICATION
# Keep this file secure as it contains sensitive credentials

DOMAIN_NAME=${domain_name}
ADMIN_EMAIL=${admin_email}
DB_PASSWORD=${db_password}
JWT_KEY=${jwt_key}
JWT_SECRET=${jwt_secret}
ADMIN_PASSWORD=${admin_password}
ADMIN_AUTH_SECRET=${admin_auth_secret}
MIROTALK_API_KEY=${mirotalk_api_key}
TURN_PASSWORD=${turn_password}
OME_API_TOKEN=${ome_api_token}
OME_WEBHOOK_SECRET=${ome_webhook_secret}
FRONTEND_URL=https://live.colourstream.${domain_name}
VIDEO_URL=https://video.colourstream.${domain_name}
EOL
  chmod 600 env.reference
  echo "✅ Created credentials reference file"
  
  echo
  echo "Secrets rotation complete!"
  echo "New credentials have been saved to env.reference"
  echo
  echo "To apply these changes, restart the containers with:"
  echo "docker-compose down && docker-compose up -d"
}

# Function to perform full setup
perform_full_setup() {
  # Clean any stale docker-compose.yml
  if [ -f "docker-compose.yml" ]; then
    echo "Removing existing docker-compose.yml..."
    rm docker-compose.yml
  fi

  # Create directories
  echo "Creating required directories..."
  mkdir -p backend/logs backend/uploads backend/prisma postgres traefik certs/certs certs/private ovenmediaengine/origin_conf ovenmediaengine/edge_conf coturn mirotalk

  # Get user input
  domain_name=$(get_domain)
  admin_email=$(get_admin_email)

  # Generate random passwords
  db_password=$(generate_password)
  jwt_key=$(generate_password)
  jwt_secret=$(generate_password)  # Generate separate JWT_SECRET
  admin_password=$(generate_password)
  admin_auth_secret=$(generate_password)
  mirotalk_api_key=$(generate_password)
  turn_password=$(generate_password)
  ome_api_token=$(generate_password)
  ome_webhook_secret=$(generate_password)

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

  # Create backend/.env
  echo "Creating backend/.env..."
  cat > backend/.env << EOL
# Backend Environment Variables
NODE_ENV=production
PORT=5001
DATABASE_URL=postgresql://colourstream:${db_password}@colourstream-postgres:5432/colourstream
JWT_KEY=${jwt_key}
JWT_SECRET=${jwt_secret}
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
OME_WEBHOOK_SECRET=${ome_webhook_secret}
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
MIROTALK_API_KEY_SECRET=${mirotalk_api_key}
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
  sed -i.bak "s/OME_WEBHOOK_SECRET: \"[^\"]*\"/OME_WEBHOOK_SECRET: \"${ome_webhook_secret}\"/g" docker-compose.yml
  sed -i.bak "s/JWT_SECRET: \"[^\"]*\"/JWT_SECRET: \"${jwt_secret}\"/g" docker-compose.yml
  sed -i.bak "s/MIROTALK_API_KEY: \"[^\"]*\"/MIROTALK_API_KEY: \"${mirotalk_api_key}\"/g" docker-compose.yml
  sed -i.bak "s/MIROTALK_API_KEY_SECRET: \"[^\"]*\"/MIROTALK_API_KEY_SECRET: \"${mirotalk_api_key}\"/g" docker-compose.yml

  # Update OME_HOST_IP to use domain name instead of IP address
  sed -i.bak "s/OME_HOST_IP: \"[^\"]*\"/OME_HOST_IP: \"live.colourstream.${domain_name}\"/g" docker-compose.yml

  rm docker-compose.yml.bak
  echo "✅ Updated docker-compose.yml"

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
POSTGRES_PASSWORD=${db_password}
DB_NAME=colourstream

# Security
JWT_KEY=${jwt_key}
JWT_SECRET=${jwt_secret}
ADMIN_AUTH_SECRET=${admin_auth_secret}
ADMIN_PASSWORD=${admin_password}

# MiroTalk Configuration
MIROTALK_API_KEY=${mirotalk_api_key}
MIROTALK_API_KEY_SECRET=${mirotalk_api_key}
MIROTALK_USERNAME=admin
MIROTALK_PASSWORD=${admin_password}

# TURN Server
TURN_SERVER_ENABLED=true
TURN_SERVER_USERNAME=colourstream
TURN_SERVER_CREDENTIAL=${turn_password}

# OvenMediaEngine
OME_API_ACCESS_TOKEN=${ome_api_token}
OME_WEBHOOK_SECRET=${ome_webhook_secret}
OME_LIVE_DOMAIN=live.colourstream.${domain_name}
OME_VIDEO_DOMAIN=video.colourstream.${domain_name}
EOL
  chmod 600 global.env
  echo "✅ Created global.env"

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
JWT_SECRET=${jwt_secret}
ADMIN_PASSWORD=${admin_password}
ADMIN_AUTH_SECRET=${admin_auth_secret}
MIROTALK_API_KEY=${mirotalk_api_key}
TURN_PASSWORD=${turn_password}
OME_API_TOKEN=${ome_api_token}
OME_WEBHOOK_SECRET=${ome_webhook_secret}
FRONTEND_URL=https://live.colourstream.${domain_name}
VIDEO_URL=https://video.colourstream.${domain_name}
EOL
  chmod 600 env.reference
  echo "✅ Created credentials reference file"
}

# Main script logic
if check_configured; then
  echo
  echo "This system appears to be already configured."
  echo
  echo "What would you like to do?"
  echo "1) Rotate secrets only (keep existing domain and configuration)"
  echo "2) Perform full setup (will overwrite existing configuration)"
  echo "3) Exit without changes"
  echo
  read -p "Enter your choice (1-3): " choice
  
  case $choice in
    1)
      rotate_secrets
      ;;
    2)
      echo "Proceeding with full setup. This will overwrite your existing configuration."
      read -p "Are you sure you want to continue? (y/n): " confirm
      if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        perform_full_setup
      else
        echo "Setup cancelled."
        exit 0
      fi
      ;;
    3)
      echo "Exiting without changes."
      exit 0
      ;;
    *)
      echo "Invalid choice. Exiting."
      exit 1
      ;;
  esac
else
  echo "No existing configuration found. Proceeding with full setup."
  perform_full_setup
fi

echo
echo "Setup completed successfully!"
echo
echo "Next steps:"
echo "1. Set up DNS records:"
printf "   - live.colourstream.%s -> Your server IP\n" "${domain_name}"
printf "   - video.colourstream.%s -> Your server IP\n" "${domain_name}"
echo
echo "2. Start the application:"
echo "   docker-compose up -d"
echo
echo "3. Login with the admin credentials found in env.reference"
echo "   KEEP THIS FILE SECURE!" 