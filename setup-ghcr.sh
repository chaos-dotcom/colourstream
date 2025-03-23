#!/bin/bash

# ColourStream Setup Script
# Automatically generates configuration from templates with secure secrets

# Constants
REPO_URL="https://raw.githubusercontent.com/johnr24/colourstream/main"
TEMPLATES_DIR="templates"

# Function to check required dependencies
check_dependencies() {
  echo "Checking dependencies..."
  for cmd in docker curl git openssl; do
    if ! command -v $cmd >/dev/null 2>&1; then
      echo "Error: $cmd is not installed."
      echo "Please install $cmd and run this script again."
      exit 1
    fi
  done
  
  # Check for docker compose
  if ! (command -v "docker-compose" >/dev/null 2>&1 || 
       (command -v "docker" >/dev/null 2>&1 && docker compose version >/dev/null 2>&1)); then
    echo "Error: docker compose is not installed."
    echo "Please install Docker Compose and run this script again."
    exit 1
  fi
  
  echo "✅ All dependencies found."
}

# Function to create directories
create_directories() {
  echo "Creating required directories..."
  mkdir -p backend/logs backend/uploads backend/prisma postgres traefik certs/certs certs/private \
           ovenmediaengine/origin_conf ovenmediaengine/edge_conf coturn mirotalk frontend \
           companion-data minio-data $TEMPLATES_DIR
  
  # Initialize Traefik ACME file with proper permissions
  touch traefik/acme.json
  chmod 600 traefik/acme.json
  
  echo "✅ Directories created."
}

# Function to download templates
download_templates() {
  echo "Downloading template files..."
  
  # Define template files to download
  templates=(
    "docker-compose.template.yml"
    "global.env.template"
    "backend/.env.template"
    "frontend/.env.template"
    "mirotalk/.env.template"
    "companion/.env.template"
    "coturn/turnserver.conf.template"
  )
  
  # Download each template
  for template in "${templates[@]}"; do
    # Extract the filename without path
    filename=$(basename "$template")
    # Extract the directory part
    dir=$(dirname "$template")
    
    # Create output directory if it has a path
    if [ "$dir" != "." ]; then
      mkdir -p "$TEMPLATES_DIR/$dir"
    fi
    
    echo "Downloading $template..."
    if ! curl -s -o "$TEMPLATES_DIR/$template" "$REPO_URL/$template"; then
      echo "⚠️ Failed to download $template"
      return 1
    fi
  done
  
  echo "✅ Template files downloaded successfully"
  return 0
}

# Function to generate a secure random password
generate_password() {
  openssl rand -hex 16
}

# Function to get user input with validation
get_input() {
  local prompt="$1"
  local var_name="$2"
  local input_value=""
  
  while [ -z "$input_value" ]; do
    printf "$prompt: "
    read input_value
    input_value=$(echo "$input_value" | tr -d '\n\r' | xargs)
    if [ -z "$input_value" ]; then
      echo "$var_name cannot be empty. Please try again."
    fi
  done
  
  echo "$input_value"
}

# Function to generate all secrets and configurations
generate_configs() {
  echo "Generating secure configurations..."
  
  # Get required user input with proper input handling
  domain_name=""
  while [ -z "$domain_name" ]; do
    printf "Enter your domain name (e.g., example.com): "
    read domain_name
    domain_name=$(echo "$domain_name" | tr -d '\n\r' | xargs)
    if [ -z "$domain_name" ]; then
      echo "Domain name cannot be empty. Please try again."
    fi
  done
  
  admin_email=""
  while [ -z "$admin_email" ]; do
    printf "Enter admin email address: "
    read admin_email
    admin_email=$(echo "$admin_email" | tr -d '\n\r' | xargs)
    if [ -z "$admin_email" ]; then
      echo "Admin email cannot be empty. Please try again."
    fi
  done
  
  # Generate all secrets
  db_password=$(generate_password)
  jwt_key=$(generate_password)
  jwt_secret=$(generate_password)
  admin_password=$(generate_password)
  admin_auth_secret=$(generate_password)
  mirotalk_api_key=$(generate_password)
  turn_password=$(generate_password)
  ome_api_token=$(generate_password)
  ome_webhook_secret=$(generate_password)
  minio_root_user=$(generate_password)
  minio_root_password=$(generate_password)
  
  echo "✅ Configurations generated."
}

# Function to apply template with configuration values
process_template() {
  local template_file="$1"
  local output_file="$2"
  
  if [ ! -f "$template_file" ]; then
    echo "Template file not found: $template_file"
    return 1
  fi
  
  echo "Processing template: $template_file -> $output_file"
  
  # Create output directory if needed
  mkdir -p "$(dirname "$output_file")"
  
  # Copy template to output file
  cp "$template_file" "$output_file"
  
  # Replace placeholders with values
  sed -i "s/\${DOMAIN}/${domain_name}/g" "$output_file"
  sed -i "s/\${ADMIN_EMAIL}/${admin_email}/g" "$output_file"
  sed -i "s/\${DB_PASSWORD}/${db_password}/g" "$output_file"
  sed -i "s/\${JWT_KEY}/${jwt_key}/g" "$output_file"
  sed -i "s/\${JWT_SECRET}/${jwt_secret}/g" "$output_file"
  sed -i "s/\${ADMIN_PASSWORD}/${admin_password}/g" "$output_file"
  sed -i "s/\${ADMIN_AUTH_SECRET}/${admin_auth_secret}/g" "$output_file"
  sed -i "s/\${MIROTALK_API_KEY}/${mirotalk_api_key}/g" "$output_file"
  sed -i "s/\${MIROTALK_API_KEY_SECRET}/${mirotalk_api_key}/g" "$output_file"
  sed -i "s/\${TURN_SERVER_CREDENTIAL}/${turn_password}/g" "$output_file"
  sed -i "s/\${OME_API_ACCESS_TOKEN}/${ome_api_token}/g" "$output_file"
  sed -i "s/\${OME_WEBHOOK_SECRET}/${ome_webhook_secret}/g" "$output_file"
  sed -i "s/\${MINIO_ROOT_USER}/${minio_root_user}/g" "$output_file"
  sed -i "s/\${MINIO_ROOT_PASSWORD}/${minio_root_password}/g" "$output_file"
  sed -i "s/\${NAMEFORUPLOADCOMPLETION}/User/g" "$output_file"
  
  # Set proper permissions
  chmod 600 "$output_file"
  
  echo "✅ Created $output_file"
  return 0
}

# Function to process all templates
process_all_templates() {
  echo "Processing all templates..."
  
  # Process each template file
  process_template "$TEMPLATES_DIR/docker-compose.template.yml" "docker-compose.yml"
  process_template "$TEMPLATES_DIR/global.env.template" "global.env"
  process_template "$TEMPLATES_DIR/backend/.env.template" "backend/.env"
  process_template "$TEMPLATES_DIR/frontend/.env.template" "frontend/.env"
  process_template "$TEMPLATES_DIR/mirotalk/.env.template" "mirotalk/.env"
  process_template "$TEMPLATES_DIR/companion/.env.template" ".env.companion"
  process_template "$TEMPLATES_DIR/coturn/turnserver.conf.template" "coturn/turnserver.conf"
  
  echo "✅ All templates processed."
}

# Function to create a reference file for credentials
create_reference_file() {
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
}

# Function to display next steps
display_next_steps() {
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
  printf "   - turn.colourstream.%s -> Your server IP\n" "${domain_name}"
  echo
  echo "2. Start the application:"
  echo "   docker compose up -d"
  echo
  echo "3. Login with the admin credentials found in env.reference"
  echo "   KEEP THIS FILE SECURE!"
}

# Main function
main() {
  echo "ColourStream Setup"
  echo "================="
  echo
  
  # Check for dependencies
  check_dependencies
  
  # Create required directories
  create_directories
  
  # Download templates
  if ! download_templates; then
    echo "Failed to download templates."
    echo "Please check your internet connection or download templates manually."
    exit 1
  fi
  
  # Generate configurations
  generate_configs
  
  # Process all templates
  process_all_templates
  
  # Create reference file
  create_reference_file
  
  # Display next steps
  display_next_steps
}

# Run the main function
main