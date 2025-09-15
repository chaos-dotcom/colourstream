#!/bin/bash

# ColourStream Setup Script
# Automatically generates configuration from templates with secure secrets

# Constants
REPO_URL="https://raw.githubusercontent.com/chaos-dotcom/colourstream/main"
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

# Function to download postgres.conf file
download_postgres_conf() {
  echo "Downloading PostgreSQL configuration file..."
  
  # Download postgres.conf directly from the repository
  if ! curl -s -o "postgres/postgresql.conf" "$REPO_URL/postgres/postgresql.conf"; then
    echo "⚠️ Failed to download postgresql.conf"
    return 1
  fi
  
  echo "✅ PostgreSQL configuration file downloaded successfully"
  return 0
}

# Function to download templates
download_templates() {
  echo "Downloading template files..."
  
  # Define template files to download
  templates=(
    "docker-compose.template.yml"
    ".env.template"
    "backend/.env.template"
    "frontend/.env.template"
    "mirotalk/.env.template"
    "companion/.env.template"
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
  
  # Get required user input with Ubuntu-compatible input handling
  echo -n "Enter your domain name (e.g., example.com): "
  read domain_name
  while [ -z "$domain_name" ]; do
    echo -n "Domain name cannot be empty. Please try again: "
    read domain_name
  done
  
  echo -n "Enter admin email address: "
  read admin_email
  while [ -z "$admin_email" ]; do
    echo -n "Admin email cannot be empty. Please try again: "
    read admin_email
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
  
  # Replace placeholders with values - Ubuntu compatible sed
  sed -i.bak "s|\${DOMAIN}|${domain_name}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|example.com|${domain_name}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${ADMIN_EMAIL}|${admin_email}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_secure_password_here|${db_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|DB_PASSWORD=your_secure_password_here|DB_PASSWORD=${db_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|POSTGRES_PASSWORD=your_secure_password_here|POSTGRES_PASSWORD=${db_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_jwt_key_here|${jwt_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_jwt_secret_here|${jwt_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_admin_password_here|${admin_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_admin_auth_secret_here|${admin_auth_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_mirotalk_api_key_here|${mirotalk_api_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_mirotalk_api_key_secret_here|${mirotalk_api_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_mirotalk_password_here|${admin_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_turn_server_credential_here|${turn_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_turn_credential_here|${turn_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_ome_api_token_here|${ome_api_token}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_ome_webhook_secret_here|${ome_webhook_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_minio_root_user_here|${minio_root_user}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|your_minio_root_password_here|${minio_root_password}|g" "$output_file" && rm "${output_file}.bak"
  
  # Replace values in HOST_USERS JSON object
  sed -i.bak "s|\"password\":\"your_admin_password_here\"|\"password\":\"${admin_password}\"|g" "$output_file" && rm "${output_file}.bak"

  # Ensure DATABASE_URL is correctly set with the proper password
  if [[ "$output_file" == *"backend/.env"* ]]; then
    # Create a properly formatted DATABASE_URL with the correct password
    local db_url="postgresql://colourstream:${db_password}@colourstream-postgres:5432/colourstream"
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=${db_url}|g" "$output_file" && rm "${output_file}.bak"
    echo "✅ Set correct DATABASE_URL in backend/.env"
  fi

  # Replace any remaining ${VARIABLES} with their values
  sed -i.bak "s|\${DB_PASSWORD}|${db_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${JWT_KEY}|${jwt_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${JWT_SECRET}|${jwt_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${ADMIN_PASSWORD}|${admin_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${ADMIN_AUTH_SECRET}|${admin_auth_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${MIROTALK_API_KEY}|${mirotalk_api_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${MIROTALK_API_KEY_SECRET}|${mirotalk_api_key}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${TURN_SERVER_CREDENTIAL}|${turn_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${OME_API_ACCESS_TOKEN}|${ome_api_token}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${OME_WEBHOOK_SECRET}|${ome_webhook_secret}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${MINIO_ROOT_USER}|${minio_root_user}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${MINIO_ROOT_PASSWORD}|${minio_root_password}|g" "$output_file" && rm "${output_file}.bak"
  sed -i.bak "s|\${NAMEFORUPLOADCOMPLETION}|User|g" "$output_file" && rm "${output_file}.bak"
  
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
  process_template "$TEMPLATES_DIR/.env.template" ".env"
  process_template "$TEMPLATES_DIR/backend/.env.template" "backend/.env"
  process_template "$TEMPLATES_DIR/frontend/.env.template" "frontend/.env"
  process_template "$TEMPLATES_DIR/mirotalk/.env.template" "mirotalk/.env"
  
  # Check if turnserver.conf.template exists before processing
  if [ -f "$TEMPLATES_DIR/coturn/turnserver.conf.template" ]; then
    process_template "$TEMPLATES_DIR/coturn/turnserver.conf.template" "coturn/turnserver.conf"
  elif [ -f "coturn/turnserver.conf.template" ]; then
    # Fallback to direct processing from local template
    echo "Processing turnserver.conf.template directly from local copy..."
    process_template "coturn/turnserver.conf.template" "coturn/turnserver.conf"
  else
    echo "⚠️ Warning: turnserver.conf.template not found. TURN server configuration will not be generated."
  fi
  
  echo "✅ All templates processed."
}

# Function to verify configuration consistency
verify_configs() {
  echo "Verifying configuration consistency..."
  
  # Check that passwords match across files
  main_db_password=$(grep POSTGRES_PASSWORD .env | cut -d'=' -f2)
  backend_db_url=$(grep DATABASE_URL backend/.env | cut -d'=' -f2-)
  
  if [[ "$backend_db_url" != *"$main_db_password"* ]]; then
    echo "⚠️ Database password mismatch detected in backend/.env"
    echo "Fixing DATABASE_URL in backend/.env..."
    
    # Create a properly formatted DATABASE_URL with the correct password
    local db_url_raw="postgresql://colourstream:${main_db_password}@colourstream-postgres:5432/colourstream"
    # Escape characters that might interfere with sed: / & |
    local db_url_escaped=$(echo "$db_url_raw" | sed -e 's/[\/&|]/\\&/g')
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=${db_url_escaped}|g" "backend/.env" && rm "backend/.env.bak"
    
    echo "✅ Fixed DATABASE_URL in backend/.env"
  else
    echo "✅ Database passwords consistent across configuration files"
  fi
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
  
  # Download PostgreSQL configuration file
  if ! download_postgres_conf; then
    echo "Failed to download PostgreSQL configuration file."
    echo "Please check your internet connection or download it manually."
    exit 1
  fi
  
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
  
  # Verify configuration consistency
  verify_configs
  
  # Create reference file
  create_reference_file
  
  # Display next steps
  display_next_steps
}

# Run the main function
main
