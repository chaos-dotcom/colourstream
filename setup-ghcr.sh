#!/bin/bash

# ColourStream GHCR Setup Script
# This script downloads and sets up ColourStream using GitHub Container Registry images

# Parse command line arguments
CLEAR_CONFIG=false
HELP=false

for arg in "$@"; do
  case $arg in
    --clear)
      CLEAR_CONFIG=true
      shift
      ;;
    --help)
      HELP=true
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

if $HELP; then
  echo "ColourStream GHCR Setup Script"
  echo "Usage: ./setup-ghcr.sh [options]"
  echo
  echo "Options:"
  echo "  --clear    Clear existing configuration before setup"
  echo "  --help     Show this help message"
  echo
  exit 0
fi

echo "ColourStream GHCR Setup"
echo "======================"
echo

# Function to clear existing configuration
clear_configuration() {
  echo "Clearing existing configuration..."
  
  # Remove configuration files
  rm -f global.env backend/.env frontend/.env mirotalk/.env .env.companion docker-compose.yml traefik/acme.json coturn/turnserver.conf env.reference
  
  # Optionally remove data directories - commented out for safety
  # rm -rf postgres/* backend/logs/* backend/uploads/* companion-data/* minio-data/*
  
  echo "Existing configuration cleared."
  echo
}

# If --clear was specified, clear configuration first
if $CLEAR_CONFIG; then
  clear_configuration
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check if docker compose is available (either format)
docker_compose_exists() {
  if command_exists "docker-compose"; then
    return 0
  elif command_exists "docker" && docker compose version >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Check for required commands
echo "Checking dependencies..."
for cmd in docker curl git openssl; do
  if ! command_exists $cmd; then
    echo "Error: $cmd is not installed."
    echo "Please install $cmd and run this script again."
    exit 1
  fi
done

# Special check for docker compose
if ! docker_compose_exists; then
  echo "Error: docker compose is not installed."
  echo "Please install Docker Compose (either as 'docker-compose' or 'docker compose') and run this script again."
  exit 1
fi

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
  local input_domain=""
  while [ -z "$input_domain" ]; do
    echo -n "Enter your domain name (e.g., example.com): "
    read input_domain
    input_domain=$(echo "$input_domain" | tr -d '\n\r' | xargs)
    if [ -z "$input_domain" ]; then
    echo "Domain name cannot be empty. Please try again."
  fi
  done
  echo "$input_domain"
}

# Function to prompt for admin email
get_admin_email() {
  local input_email=""
  while [ -z "$input_email" ]; do
    echo -n "Enter admin email address: "
    read input_email
    input_email=$(echo "$input_email" | tr -d '\n\r' | xargs)
    if [ -z "$input_email" ]; then
    echo "Admin email cannot be empty. Please try again."
  fi
  done
  echo "$input_email"
}

# Function to generate a random password
generate_password() {
  openssl rand -hex 16
}

# Function to download template files
download_templates() {
  echo "Downloading template files..."
  
  # Create templates directory
  mkdir -p templates
  
  # Define the base URL for raw template files
  REPO_URL="https://raw.githubusercontent.com/johnr24/colourstream/main"
  
  # Download template files
  echo "Downloading docker-compose template..."
  curl -s -o templates/docker-compose.template.yml "${REPO_URL}/docker-compose.template.yml"
  
  echo "Downloading .env templates..."
  curl -s -o templates/global.env.template "${REPO_URL}/global.env.template"
  curl -s -o templates/backend.env.template "${REPO_URL}/backend/.env.template"
  curl -s -o templates/frontend.env.template "${REPO_URL}/frontend/.env.template"
  curl -s -o templates/mirotalk.env.template "${REPO_URL}/mirotalk/.env.template"
  curl -s -o templates/companion.env.template "${REPO_URL}/companion/.env.template"
  curl -s -o templates/coturn.conf.template "${REPO_URL}/coturn/turnserver.conf.template"
  
  # Check if downloads were successful
  if [ ! -f "templates/docker-compose.template.yml" ]; then
    echo "⚠️ Failed to download templates. Using embedded templates as fallback."
    return 1
  fi
  
  echo "✅ Template files downloaded successfully"
  return 0
}

# Function to apply values to a template file
apply_template() {
  local template_file="$1"
  local output_file="$2"
  local temp_file="${output_file}.tmp"
  
  if [ ! -f "$template_file" ]; then
    echo "Template file not found: $template_file"
    return 1
  fi
  
  # Create a copy of the template
  cp "$template_file" "$temp_file"
  
  # Replace placeholders with actual values
  sed -i "s/\${DOMAIN}/${domain_name}/g" "$temp_file"
  sed -i "s/\${ADMIN_EMAIL}/${admin_email}/g" "$temp_file"
  sed -i "s/\${DB_PASSWORD}/${db_password}/g" "$temp_file"
  sed -i "s/\${JWT_KEY}/${jwt_key}/g" "$temp_file"
  sed -i "s/\${JWT_SECRET}/${jwt_secret}/g" "$temp_file"
  sed -i "s/\${ADMIN_PASSWORD}/${admin_password}/g" "$temp_file"
  sed -i "s/\${ADMIN_AUTH_SECRET}/${admin_auth_secret}/g" "$temp_file"
  sed -i "s/\${MIROTALK_API_KEY}/${mirotalk_api_key}/g" "$temp_file"
  sed -i "s/\${MIROTALK_API_KEY_SECRET}/${mirotalk_api_key}/g" "$temp_file"
  sed -i "s/\${TURN_SERVER_CREDENTIAL}/${turn_password}/g" "$temp_file"
  sed -i "s/\${OME_API_ACCESS_TOKEN}/${ome_api_token}/g" "$temp_file"
  sed -i "s/\${OME_WEBHOOK_SECRET}/${ome_webhook_secret}/g" "$temp_file"
  sed -i "s/\${MINIO_ROOT_USER}/${minio_root_user}/g" "$temp_file"
  sed -i "s/\${MINIO_ROOT_PASSWORD}/${minio_root_password}/g" "$temp_file"
  sed -i "s/\${NAMEFORUPLOADCOMPLETION}/User/g" "$temp_file"
  
  # Move the processed file to the final location
  mv "$temp_file" "$output_file"
  chmod 600 "$output_file"
  
  echo "✅ Created $output_file from template"
  return 0
}

# Function to create configuration files from embedded templates as fallback
create_embedded_configs() {
  echo "Creating configuration files from embedded templates..."
  
  # Create global.env
  cat > global.env << EOL
# Global Environment Variables
DOMAIN=${domain_name}
ADMIN_EMAIL=${admin_email}
NAMEFORUPLOADCOMPLETION=User
DB_PASSWORD=${db_password}
POSTGRES_PASSWORD=${db_password}
JWT_KEY=${jwt_key}
JWT_SECRET=${jwt_secret}
ADMIN_PASSWORD=${admin_password}
ADMIN_AUTH_SECRET=${admin_auth_secret}
MIROTALK_API_KEY=${mirotalk_api_key}
MIROTALK_API_KEY_SECRET=${mirotalk_api_key}
TURN_SERVER_CREDENTIAL=${turn_password}
OME_API_ACCESS_TOKEN=${ome_api_token}
OME_WEBHOOK_SECRET=${ome_webhook_secret}

# MinIO S3 Configuration
MINIO_ROOT_USER=${minio_root_user}
MINIO_ROOT_PASSWORD=${minio_root_password}
MINIO_DOMAIN=colourstream.${domain_name}
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=https://s3.colourstream.${domain_name}
S3_REGION=us-east-1
S3_ACCESS_KEY=${minio_root_user}
S3_SECRET_KEY=${minio_root_password}
S3_BUCKET=uploads
EOL
  chmod 600 global.env
  echo "✅ Created global.env"

  # Create backend/.env
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
HOST_USERS=[{"username":"admin", "password":"${admin_password}"}]

# S3 Configuration
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=${minio_root_user}
S3_SECRET_KEY=${minio_root_password}
S3_BUCKET=uploads
EOL
  chmod 600 backend/.env
  echo "✅ Created backend/.env"

  # Create frontend/.env
  cat > frontend/.env << EOL
# Frontend Environment Variables
VITE_API_URL=https://live.colourstream.${domain_name}/api
VITE_WEBRTC_WS_HOST=live.colourstream.${domain_name}
VITE_WEBRTC_WS_PORT=3334
VITE_WEBRTC_WS_PROTOCOL=wss
VITE_WEBRTC_APP_PATH=app
VITE_VIDEO_URL=https://video.colourstream.${domain_name}/join
VITE_OVENPLAYER_SCRIPT_URL=https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.js
VITE_UPLOAD_ENDPOINT_URL=https://upload.colourstream.${domain_name}/files/
VITE_NAMEFORUPLOADCOMPLETION=User

# S3 Integration
VITE_S3_ENDPOINT=https://s3.colourstream.${domain_name}
VITE_S3_REGION=us-east-1
VITE_S3_BUCKET=uploads

# Cloud Storage Integration
VITE_ENABLE_DROPBOX=true
VITE_ENABLE_GOOGLE_DRIVE=false
EOL
  chmod 600 frontend/.env
  echo "✅ Created frontend/.env"

  # Create mirotalk/.env
  cat > mirotalk/.env << EOL
# MiroTalk Environment Variables
NODE_ENV=production
PROTOCOL=https
PORT=3000
JWT_KEY=${jwt_key}
HOST_PASSWORD=${admin_password}
HOST_USERS=[{"username":"admin", "password":"${admin_password}"}]
TURN_SERVER_ENABLED=true
TURN_SERVER_HOST=turn.colourstream.${domain_name}
TURN_SERVER_PORT=3478
TURN_SERVER_USERNAME=colourstream
TURN_SERVER_CREDENTIAL=${turn_password}
API_KEY_SECRET=${mirotalk_api_key}
MIROTALK_API_KEY_SECRET=${mirotalk_api_key}
EOL
  chmod 600 mirotalk/.env
  echo "✅ Created mirotalk/.env"

  # Create .env.companion
  cat > .env.companion << EOL
# Companion Environment Variables
NODE_ENV=production
PORT=3020
COMPANION_SECRET=${admin_auth_secret}
COMPANION_PROTOCOL=https
COMPANION_DOMAIN=upload.colourstream.${domain_name}
COMPANION_DATADIR=/data
COMPANION_ALLOW_LOCAL_URLs=true

# S3 Configuration
COMPANION_AWS_ENDPOINT=http://minio:9000
COMPANION_AWS_BUCKET=${domain_name}-uploads
COMPANION_AWS_KEY=${minio_root_user}
COMPANION_AWS_SECRET=${minio_root_password}
COMPANION_AWS_REGION=us-east-1
COMPANION_AWS_FORCE_PATH_STYLE=true

# Companion Client Integration
COMPANION_CLIENT_ORIGINS=https://live.colourstream.${domain_name}
COMPANION_RETURN_URL=https://live.colourstream.${domain_name}
EOL
    chmod 600 .env.companion
  echo "✅ Created .env.companion"

  # Create docker-compose.yml
  cat > docker-compose.yml << EOL
version: '3.8'

services:
  traefik:
    image: traefik:v2.9
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/acme.json:/acme.json
    command:
      - "--log.level=INFO"
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=\${ADMIN_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
    labels:
      - "traefik.enable=true"

  frontend:
    image: ghcr.io/johnr24/colourstream-frontend:latest
    restart: unless-stopped
    env_file:
      - ./frontend/.env
      - ./global.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(\`live.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

  backend:
    image: ghcr.io/johnr24/colourstream-backend:latest
    restart: unless-stopped
    env_file:
      - ./backend/.env
      - ./global.env
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/uploads:/app/uploads
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(\`live.colourstream.\${DOMAIN}\`) && PathPrefix(\`/api\`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls=true"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=5001"

  colourstream-postgres:
    image: postgres:14
    restart: unless-stopped
    volumes:
      - ./postgres:/var/lib/postgresql/data
    env_file:
      - ./global.env
    environment:
      - POSTGRES_USER=colourstream
      - POSTGRES_DB=colourstream
      - POSTGRES_PASSWORD=\${DB_PASSWORD}

  origin:
    image: airensoft/ovenmediaengine:latest
    restart: unless-stopped
    ports:
      - "1935:1935"
    volumes:
      - ./ovenmediaengine/origin_conf:/opt/ovenmediaengine/bin/origin_conf
    environment:
      - OME_API_ACCESS_TOKEN=\${OME_API_ACCESS_TOKEN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.origin-ws.rule=Host(\`live.colourstream.\${DOMAIN}\`) && PathPrefix(\`/ws\`)"
      - "traefik.http.routers.origin-ws.entrypoints=websecure"
      - "traefik.http.routers.origin-ws.tls=true"
      - "traefik.http.routers.origin-ws.tls.certresolver=letsencrypt"
      - "traefik.http.services.origin-ws.loadbalancer.server.port=3333"
      - "traefik.http.routers.origin-admin.rule=Host(\`live.colourstream.\${DOMAIN}\`) && (PathPrefix(\`/login\`) || PathPrefix(\`/admin\`))"
      - "traefik.http.routers.origin-admin.entrypoints=websecure"
      - "traefik.http.routers.origin-admin.tls=true"
      - "traefik.http.routers.origin-admin.tls.certresolver=letsencrypt"
      - "traefik.http.services.origin-admin.loadbalancer.server.port=8081"

  edge:
    image: airensoft/ovenmediaengine:latest
    restart: unless-stopped
    depends_on:
      - origin
    volumes:
      - ./ovenmediaengine/edge_conf:/opt/ovenmediaengine/bin/edge_conf
    environment:
      - ORIGIN_SERVER=origin:8081
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.edge-webrtc.rule=Host(\`live.colourstream.\${DOMAIN}\`) && PathPrefix(\`/app\`)"
      - "traefik.http.routers.edge-webrtc.entrypoints=websecure"
      - "traefik.http.routers.edge-webrtc.tls=true"
      - "traefik.http.routers.edge-webrtc.tls.certresolver=letsencrypt"
      - "traefik.http.services.edge-webrtc.loadbalancer.server.port=3334"

  mirotalk:
    image: mirotalk/p2p:latest
    restart: unless-stopped
    env_file:
      - ./mirotalk/.env
      - ./global.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mirotalk.rule=Host(\`video.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.mirotalk.entrypoints=websecure"
      - "traefik.http.routers.mirotalk.tls=true"
      - "traefik.http.routers.mirotalk.tls.certresolver=letsencrypt"
      - "traefik.http.services.mirotalk.loadbalancer.server.port=3000"

  coturn:
    image: coturn/coturn
    restart: unless-stopped
    volumes:
      - ./coturn/turnserver.conf:/etc/turnserver.conf
      - ./certs/certs:/certs
    ports:
      - "3478:3478"
      - "3478:3478/udp"
      - "3480:3480"
      - "3480:3480/udp"
      - "30000-31000:30000-31000/udp"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.coturn.rule=Host(\`turn.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.coturn.entrypoints=websecure"
      - "traefik.http.routers.coturn.tls=true"
      - "traefik.http.routers.coturn.tls.certresolver=letsencrypt"
      - "traefik.http.services.coturn.loadbalancer.server.port=3480"

  uppy-companion:
    image: transloadit/companion:latest
    restart: unless-stopped
    env_file:
      - ./.env.companion
    volumes:
      - ./companion-data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.companion.rule=Host(\`upload.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.companion.entrypoints=websecure"
      - "traefik.http.routers.companion.tls=true"
      - "traefik.http.routers.companion.tls.certresolver=letsencrypt"
      - "traefik.http.services.companion.loadbalancer.server.port=3020"

  # MinIO S3 Storage
  minio:
    image: quay.io/minio/minio
    restart: unless-stopped
    volumes:
      - ./minio-data:/data
    environment:
      - MINIO_ROOT_USER=\${MINIO_ROOT_USER}
      - MINIO_ROOT_PASSWORD=\${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    env_file:
      - ./global.env
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.minio-api.rule=Host(\`s3.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.minio-api.entrypoints=websecure"
      - "traefik.http.routers.minio-api.tls=true"
      - "traefik.http.routers.minio-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.minio-api.loadbalancer.server.port=9000"
      - "traefik.http.routers.minio-console.rule=Host(\`s3-console.colourstream.\${DOMAIN}\`)"
      - "traefik.http.routers.minio-console.entrypoints=websecure"
      - "traefik.http.routers.minio-console.tls=true"
      - "traefik.http.routers.minio-console.tls.certresolver=letsencrypt"
      - "traefik.http.services.minio-console.loadbalancer.server.port=9001"

  # MinIO Bucket setup
  minio-mc:
    image: minio/mc
    restart: no
    depends_on:
      - minio
    entrypoint: >
      /bin/sh -c "
      sleep 10;
      /usr/bin/mc config host add myminio http://minio:9000 \${MINIO_ROOT_USER} \${MINIO_ROOT_PASSWORD};
      /usr/bin/mc mb --ignore-existing myminio/uploads;
      /usr/bin/mc policy set public myminio/uploads;
      exit 0;
      "
    env_file:
      - ./global.env
EOL
    chmod 600 docker-compose.yml
  echo "✅ Created docker-compose.yml"

  # Create empty Traefik ACME file with proper permissions
  echo "Creating Traefik ACME file..."
  mkdir -p traefik
  touch traefik/acme.json
  chmod 600 traefik/acme.json
  echo "✅ Created Traefik ACME file"

  # Create coturn config
  echo "Creating Coturn configuration..."
  mkdir -p coturn
  cat > coturn/turnserver.conf << EOL
# Coturn TURN SERVER configuration file
# Simple configuration file for ColourStream TURN server
listening-port=3480
min-port=30000
max-port=31000
fingerprint
lt-cred-mech
user=colourstream:${turn_password}
realm=colourstream.${domain_name}
cert=/certs/video.colourstream.${domain_name}.crt
pkey=/certs/video.colourstream.${domain_name}.key
# For debugging only
# verbose
# Bandwidth limitation
user-quota=12800
total-quota=102400
EOL
  chmod 600 coturn/turnserver.conf
  echo "✅ Created Coturn configuration"

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

# MinIO S3 Credentials
MINIO_ROOT_USER=${minio_root_user}
MINIO_ROOT_PASSWORD=${minio_root_password}

# URLs
FRONTEND_URL=https://live.colourstream.${domain_name}
VIDEO_URL=https://video.colourstream.${domain_name}
S3_URL=https://s3.colourstream.${domain_name}
S3_CONSOLE_URL=https://s3-console.colourstream.${domain_name}
EOL
  chmod 600 env.reference
  echo "✅ Created credentials reference file"

  # Create directory for companion data
  mkdir -p companion-data
  mkdir -p minio-data

  echo "Setup completed successfully!"
  echo
  echo "Next steps:"
  echo "1. Add SSL certificates to the certs directory or let Traefik generate them automatically"
  echo "2. Set up DNS records for your domains:"
  printf "   - live.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - video.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - upload.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - s3.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - s3-console.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - turn.colourstream.%s -> Your server IP\n" "${domain_name}"
  echo "3. Start the application with: docker compose up -d"
  echo
  echo "Important: Check env.reference for your admin credentials and keep it secure!"
}

# Function to rotate secrets only
rotate_secrets() {
  echo "Rotating secrets for existing installation..."
  
  # Extract current domain and email from existing configuration
  # DO NOT modify these during rotation
  domain_name=$(grep "DOMAIN=" global.env | cut -d'=' -f2)
  admin_email=$(grep "ADMIN_EMAIL=" global.env | cut -d'=' -f2)
  
  echo "Preserving existing domain configuration:"
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
  
  # First, try to download and use templates (DRY approach)
  download_templates
  download_success=$?
  
  if [ $download_success -eq 0 ]; then
    # Successfully downloaded templates, apply with just the security parameters
    apply_template "templates/global.env.template" "global.env"
    apply_template "templates/backend.env.template" "backend/.env"
    apply_template "templates/mirotalk.env.template" "mirotalk/.env"
    apply_template "templates/companion.env.template" ".env.companion"
    apply_template "templates/coturn.conf.template" "coturn/turnserver.conf"
  else
    # Fallback to traditional find and replace
    # Update global.env with new secrets
    sed -i.bak "s/DB_PASSWORD=.*/DB_PASSWORD=${db_password}/g" global.env
    sed -i.bak "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${db_password}/g" global.env
    sed -i.bak "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" global.env
    sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/g" global.env
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
    # Update HOST_USERS configuration
    sed -i.bak "s/HOST_USERS=.*/HOST_USERS=[{\"username\":\"admin\", \"password\":\"${admin_password}\"}]/g" backend/.env
    
    # Update mirotalk/.env with new secrets
    sed -i.bak "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=${turn_password}/g" mirotalk/.env
    sed -i.bak "s/API_KEY_SECRET=.*/API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
    sed -i.bak "s/MIROTALK_API_KEY_SECRET=.*/MIROTALK_API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
    sed -i.bak "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" mirotalk/.env
    sed -i.bak "s/HOST_PASSWORD=.*/HOST_PASSWORD=${admin_password}/g" mirotalk/.env
    # Update HOST_USERS configuration
    sed -i.bak "s/HOST_USERS=.*/HOST_USERS=[{\"username\":\"admin\", \"password\":\"${admin_password}\"}]/g" mirotalk/.env
    
    # Update coturn config
    sed -i.bak "s/user=colourstream:.*/user=colourstream:${turn_password}/g" coturn/turnserver.conf
  fi
  
  # Update docker-compose.yml - create it from the template if it doesn't exist
  if [ ! -f "docker-compose.yml" ] && [ -f "templates/docker-compose.template.yml" ]; then
    echo "Creating docker-compose.yml from template..."
    apply_template "templates/docker-compose.template.yml" "docker-compose.yml"
  elif [ ! -f "docker-compose.yml" ] && [ -f "docker-compose.template.yml" ]; then
    echo "Creating docker-compose.yml from local template..."
    cp docker-compose.template.yml docker-compose.yml
  fi
  
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

# Existing URLs (preserved)
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
  mkdir -p backend/logs backend/uploads backend/prisma postgres traefik certs/certs certs/private ovenmediaengine/origin_conf ovenmediaengine/edge_conf coturn mirotalk frontend

  # Get user input
  echo "Please provide the following information:"
  echo "----------------------------------------"
  domain_name=$(get_domain)
  echo "Domain set to: $domain_name"
  admin_email=$(get_admin_email)
  echo "Admin email set to: $admin_email"
  echo "----------------------------------------"
  
  # Verify inputs
  echo "Please confirm these settings:"
  echo "Domain: $domain_name"
  echo "Admin Email: $admin_email"
  read -p "Are these correct? (y/n): " confirm
  if [[ ! $confirm =~ ^[Yy] ]]; then
    echo "Let's try again..."
    perform_full_setup
    return
  fi

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
  minio_root_user=$(generate_password)
  minio_root_password=$(generate_password)

  echo
  echo "Creating configuration files..."

  # First, try to download and use templates (DRY approach)
  download_templates
  download_success=$?
  
  if [ $download_success -eq 0 ]; then
    # Successfully downloaded templates, use them
    apply_template "templates/global.env.template" "global.env"
    apply_template "templates/backend.env.template" "backend/.env"
    apply_template "templates/frontend.env.template" "frontend/.env"
    apply_template "templates/mirotalk.env.template" "mirotalk/.env"
    apply_template "templates/companion.env.template" ".env.companion"
    apply_template "templates/docker-compose.template.yml" "docker-compose.yml"
    apply_template "templates/coturn.conf.template" "coturn/turnserver.conf"
  else
    # Fallback to embedded templates if download failed
    create_embedded_configs
  fi

  # Create empty Traefik ACME file with proper permissions
  echo "Creating Traefik ACME file..."
  mkdir -p traefik
  touch traefik/acme.json
  chmod 600 traefik/acme.json
  echo "✅ Created Traefik ACME file"

  # Create directories for data storage
  mkdir -p companion-data
  mkdir -p minio-data

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

# MinIO S3 Credentials
MINIO_ROOT_USER=${minio_root_user}
MINIO_ROOT_PASSWORD=${minio_root_password}

# URLs
FRONTEND_URL=https://live.colourstream.${domain_name}
VIDEO_URL=https://video.colourstream.${domain_name}
S3_URL=https://s3.colourstream.${domain_name}
S3_CONSOLE_URL=https://s3-console.colourstream.${domain_name}
EOL
  chmod 600 env.reference
  echo "✅ Created credentials reference file"

  echo "Setup completed successfully!"
  echo
  echo "Next steps:"
  echo "1. Add SSL certificates to the certs directory or let Traefik generate them automatically"
  echo "2. Set up DNS records for your domains:"
  printf "   - live.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - video.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - upload.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - s3.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - s3-console.colourstream.%s -> Your server IP\n" "${domain_name}"
  printf "   - turn.colourstream.%s -> Your server IP\n" "${domain_name}"
  echo "3. Start the application with: docker compose up -d"
  echo
  echo "Important: Check env.reference for your admin credentials and keep it secure!"
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
printf "   - upload.colourstream.%s -> Your server IP\n" "${domain_name}"
printf "   - s3.colourstream.%s -> Your server IP\n" "${domain_name}"
printf "   - s3-console.colourstream.%s -> Your server IP\n" "${domain_name}"
echo
echo "2. Start the application:"
echo "   docker compose up -d"
echo
echo "3. Login with the admin credentials found in env.reference"
echo "   KEEP THIS FILE SECURE!" 