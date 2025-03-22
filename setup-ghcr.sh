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
  echo "Error: Unable to download templates automatically."
  echo
  echo "Please try one of the following approaches:"
  echo
  echo "1. Check your internet connection and retry this script."
  echo
  echo "2. Download the templates manually with the following commands:"
  echo "   mkdir -p templates"
  echo "   curl -o templates/docker-compose.template.yml https://raw.githubusercontent.com/johnr24/colourstream/main/docker-compose.template.yml"
  echo "   curl -o templates/global.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/.env.template"
  echo "   curl -o templates/backend.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/backend/.env.template"
  echo "   curl -o templates/frontend.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/frontend/.env.template" 
  echo "   curl -o templates/mirotalk.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/mirotalk/.env.template"
  echo "   curl -o templates/companion.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/companion/.env.template"
  echo "   curl -o templates/coturn.conf.template https://raw.githubusercontent.com/johnr24/colourstream/main/coturn/turnserver.conf.template"
  echo
  echo "   Then run this script again."
  echo
  echo "3. Clone the entire repository to access all templates:"
  echo "   git clone https://github.com/johnr24/colourstream.git"
  echo "   cd colourstream"
  echo "   ./setup-ghcr.sh"
  echo
  exit 1
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
    # Show error and exit - force use of templates to maintain DRY
    echo "Error: Unable to download templates for rotation."
    echo
    echo "To comply with DRY principles, this script requires template files."
    echo "Please try one of the following approaches:"
    echo
    echo "1. Check your internet connection and retry this script."
    echo
    echo "2. Download the templates manually with the following commands:"
    echo "   mkdir -p templates"
    echo "   curl -o templates/global.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/global.env.template"
    echo "   curl -o templates/backend.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/backend/.env.template"
    echo "   curl -o templates/mirotalk.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/mirotalk/.env.template"
    echo "   curl -o templates/companion.env.template https://raw.githubusercontent.com/johnr24/colourstream/main/companion/.env.template"
    echo "   curl -o templates/coturn.conf.template https://raw.githubusercontent.com/johnr24/colourstream/main/coturn/turnserver.conf.template"
    echo
    echo "   Then run this script again."
    echo
    echo "3. Clone the entire repository to access all templates:"
    echo "   git clone https://github.com/johnr24/colourstream.git"
    echo "   cd colourstream"
    echo "   ./setup-ghcr.sh"
    echo
    exit 1
  fi
  
  # Update docker-compose.yml - create it from the template if it doesn't exist
  if [ ! -f "docker-compose.yml" ] && [ -f "templates/docker-compose.template.yml" ]; then
    echo "Creating docker-compose.yml from template..."
    apply_template "templates/docker-compose.template.yml" "docker-compose.yml"
  elif [ ! -f "docker-compose.yml" ] && [ -f "docker-compose.template.yml" ]; then
    echo "Creating docker-compose.yml from local template..."
    cp docker-compose.template.yml docker-compose.yml
  fi
  
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