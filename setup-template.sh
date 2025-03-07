#!/bin/bash

# ColourStream Template Setup Script
# This script helps initialize configuration files from templates

echo "ColourStream Template Setup"
echo "=========================="
echo

# Cleanup function to remove incorrect files with quotes in their names
cleanup_quoted_files() {
  echo "Cleaning up any existing files with quotes in their names..."
  
  # Find and delete files with quotes in their names ('' or "")
  find . -name "*''" -type f -delete
  find . -name '*""' -type f -delete
  find . -name '*"' -type f -delete
  
  # Delete specific known problematic files if they exist
  files_to_check=(
    "global.env''"
    "docker-compose.yml''"
    "backend/.env''"
    "frontend/.env''"
    "mirotalk/.env''"
  )
  
  for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
      rm -f "$file"
      echo "  Removed: $file"
    fi
  done
}

# Run cleanup before starting
cleanup_quoted_files

# Detect OS for sed in-place editing compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
  # For macOS: use separate extension parameter
  sed_inplace() {
    sed -i "" "$@"
  }
else
  # For Linux and others
  sed_inplace() {
    sed -i "$@"
  }
fi

# Function to check if environment is already configured
check_configured() {
  if [ -f "global.env" ]; then
    # Extract domain from global.env
    if grep -q "DOMAIN=" global.env; then
      configured_domain=$(grep "DOMAIN=" global.env | cut -d'=' -f2)
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
  
  # Extract current domain and email from global.env
  domain_name=$(grep "DOMAIN=" global.env | cut -d'=' -f2)
  # Clean the domain name to ensure no newlines or extra spaces
  domain_name=$(echo "$domain_name" | tr -d '\n\r' | xargs)
  admin_email=$(grep "ADMIN_EMAIL=" global.env | cut -d'=' -f2 2>/dev/null || echo "admin@$domain_name")
  
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
  if [ -f "global.env" ]; then
    sed_inplace "s/DB_PASSWORD=.*/DB_PASSWORD=${db_password}/g" global.env
    sed_inplace "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${db_password}/g" global.env
    sed_inplace "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" global.env
    sed_inplace "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${admin_password}/g" global.env
    sed_inplace "s/ADMIN_AUTH_SECRET=.*/ADMIN_AUTH_SECRET=${admin_auth_secret}/g" global.env
    sed_inplace "s/MIROTALK_API_KEY=.*/MIROTALK_API_KEY=${mirotalk_api_key}/g" global.env
    sed_inplace "s/MIROTALK_API_KEY_SECRET=.*/MIROTALK_API_KEY_SECRET=${mirotalk_api_key}/g" global.env
    sed_inplace "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=${turn_password}/g" global.env
    sed_inplace "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=${ome_api_token}/g" global.env
    sed_inplace "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=${ome_webhook_secret}/g" global.env
    echo "✅ Updated global.env"
  else
    echo "❌ global.env not found"
  fi
  
  # Update backend/.env with new secrets
  if [ -f "backend/.env" ]; then
    sed_inplace "s/DATABASE_URL=.*/DATABASE_URL=postgresql:\/\/colourstream:${db_password}@colourstream-postgres:5432\/colourstream/g" backend/.env
    sed_inplace "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" backend/.env
    sed_inplace "s/JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/g" backend/.env
    sed_inplace "s/ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${admin_password}/g" backend/.env
    sed_inplace "s/ADMIN_AUTH_SECRET=.*/ADMIN_AUTH_SECRET=${admin_auth_secret}/g" backend/.env
    sed_inplace "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=${ome_api_token}/g" backend/.env
    sed_inplace "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=${ome_webhook_secret}/g" backend/.env
    echo "✅ Updated backend/.env"
  else
    echo "❌ backend/.env not found"
  fi
  
  # Update mirotalk/.env with new secrets
  if [ -f "mirotalk/.env" ]; then
    sed_inplace "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=${turn_password}/g" mirotalk/.env
    sed_inplace "s/API_KEY_SECRET=.*/API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
    sed_inplace "s/MIROTALK_API_KEY_SECRET=.*/MIROTALK_API_KEY_SECRET=${mirotalk_api_key}/g" mirotalk/.env
    sed_inplace "s/JWT_KEY=.*/JWT_KEY=${jwt_key}/g" mirotalk/.env
    sed_inplace "s/HOST_PASSWORD=.*/HOST_PASSWORD=${admin_password}/g" mirotalk/.env
    echo "✅ Updated mirotalk/.env"
  else
    echo "❌ mirotalk/.env not found"
  fi
  
  # Update coturn config
  if [ -f "coturn/turnserver.conf" ]; then
    sed_inplace "s/user=colourstream:.*/user=colourstream:${turn_password}/g" coturn/turnserver.conf
    echo "✅ Updated turnserver.conf"
  else
    echo "❌ coturn/turnserver.conf not found"
  fi
  
  # Update docker-compose.yml
  if [ -f "docker-compose.yml" ]; then
    sed_inplace "s/POSTGRES_PASSWORD: \"[^\"]*\"/POSTGRES_PASSWORD: \"${db_password}\"/g" docker-compose.yml
    sed_inplace "s/DATABASE_URL: \"postgresql:\/\/colourstream:.*@colourstream-postgres/DATABASE_URL: \"postgresql:\/\/colourstream:${db_password}@colourstream-postgres/g" docker-compose.yml
    sed_inplace "s/JWT_KEY: \"[^\"]*\"/JWT_KEY: \"${jwt_key}\"/g" docker-compose.yml
    sed_inplace "s/JWT_SECRET: \"[^\"]*\"/JWT_SECRET: \"${jwt_secret}\"/g" docker-compose.yml
    sed_inplace "s/ADMIN_AUTH_SECRET: \"[^\"]*\"/ADMIN_AUTH_SECRET: \"${admin_auth_secret}\"/g" docker-compose.yml
    sed_inplace "s/OME_API_ACCESS_TOKEN: \"[^\"]*\"/OME_API_ACCESS_TOKEN: \"${ome_api_token}\"/g" docker-compose.yml
    sed_inplace "s/OME_WEBHOOK_SECRET: \"[^\"]*\"/OME_WEBHOOK_SECRET: \"${ome_webhook_secret}\"/g" docker-compose.yml
    sed_inplace "s/TURN_SERVER_CREDENTIAL: \"[^\"]*\"/TURN_SERVER_CREDENTIAL: \"${turn_password}\"/g" docker-compose.yml
    sed_inplace "s/MIROTALK_API_KEY: \"[^\"]*\"/MIROTALK_API_KEY: \"${mirotalk_api_key}\"/g" docker-compose.yml
    sed_inplace "s/MIROTALK_API_KEY_SECRET: \"[^\"]*\"/MIROTALK_API_KEY_SECRET: \"${mirotalk_api_key}\"/g" docker-compose.yml
    echo "✅ Updated docker-compose.yml"
  else
    echo "❌ docker-compose.yml not found"
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
  echo "Creating configuration files..."

  # Create docker-compose.yml from template
  if [ -f "docker-compose.template.yml" ]; then
    cp docker-compose.template.yml docker-compose.yml
    
    # Replace domains in host rules
    sed_inplace "s/example.com/$domain_name/g" docker-compose.yml
    sed_inplace "s/admin@example.com/$admin_email/g" docker-compose.yml
    sed_inplace "s/--certificatesresolvers.myresolver.acme.email=admin@example.com/--certificatesresolvers.myresolver.acme.email=$admin_email/g" docker-compose.yml
    
    # Replace domains in environment variables for frontend
    sed_inplace "s|VITE_API_URL: https://live.colourstream.example.com/api|VITE_API_URL: https://live.colourstream.$domain_name/api|g" docker-compose.yml
    sed_inplace "s|VITE_WEBRTC_WS_HOST: live.colourstream.example.com|VITE_WEBRTC_WS_HOST: live.colourstream.$domain_name|g" docker-compose.yml
    sed_inplace "s|VITE_VIDEO_URL: https://video.colourstream.example.com/join|VITE_VIDEO_URL: https://video.colourstream.$domain_name/join|g" docker-compose.yml
    
    # Update OvenMediaEngine host to use domain name instead of IP
    sed_inplace "s|OME_HOST_IP: \"[^\"]*\"|OME_HOST_IP: \"live.colourstream.$domain_name\"|g" docker-compose.yml
    
    # Update OvenMediaEngine webhook secret
    sed_inplace "s|OME_WEBHOOK_SECRET: \"[^\"]*\"|OME_WEBHOOK_SECRET: \"$ome_webhook_secret\"|g" docker-compose.yml
    
    echo "✅ Created docker-compose.yml"
  else
    echo "❌ docker-compose.template.yml not found"
  fi

  # Create global.env from template
  if [ -f "global.env.template" ]; then
    cp global.env.template global.env
    sed_inplace "s/example.com/$domain_name/g" global.env
    sed_inplace "s/your_secure_password_here/$db_password/g" global.env
    sed_inplace "s/your_jwt_key_here/$jwt_key/g" global.env
    sed_inplace "s/your_mirotalk_api_key_here/$mirotalk_api_key/g" global.env
    sed_inplace "s/globalUsername/admin/g" global.env
    sed_inplace "s/globalPassword/$admin_password/g" global.env
    
    # Add missing credentials to global.env if they don't already exist
    if ! grep -q "ADMIN_AUTH_SECRET" global.env; then
      echo -e "\n# Admin Authentication" >> global.env
      echo "ADMIN_AUTH_SECRET=$admin_auth_secret" >> global.env
    else
      sed_inplace "s/ADMIN_AUTH_SECRET=.*/ADMIN_AUTH_SECRET=$admin_auth_secret/g" global.env
    fi
    
    # Add OME API token with appropriate naming
    if ! grep -q "OME_API_ACCESS_TOKEN" global.env; then
      echo -e "\n# OvenMediaEngine Configuration" >> global.env
      echo "OME_API_ACCESS_TOKEN=$ome_api_token" >> global.env
    else
      sed_inplace "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=$ome_api_token/g" global.env
    fi
    
    # Add OME Webhook Secret
    if ! grep -q "OME_WEBHOOK_SECRET" global.env; then
      echo "OME_WEBHOOK_SECRET=$ome_webhook_secret" >> global.env
    else
      sed_inplace "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=$ome_webhook_secret/g" global.env
    fi
    
    # Add OvenMediaEngine domain variables
    if ! grep -q "OME_LIVE_DOMAIN" global.env; then
      echo "OME_LIVE_DOMAIN=live.colourstream.$domain_name" >> global.env
      echo "OME_VIDEO_DOMAIN=video.colourstream.$domain_name" >> global.env
    else
      sed_inplace "s/OME_LIVE_DOMAIN=.*/OME_LIVE_DOMAIN=live.colourstream.$domain_name/g" global.env
      sed_inplace "s/OME_VIDEO_DOMAIN=.*/OME_VIDEO_DOMAIN=video.colourstream.$domain_name/g" global.env
    fi
    
    # Add TURN server credentials
    if ! grep -q "TURN_SERVER_CREDENTIAL" global.env; then
      echo -e "\n# TURN Server Configuration" >> global.env
      echo "TURN_SERVER_ENABLED=true" >> global.env
      echo "TURN_SERVER_USERNAME=colourstream" >> global.env  
      echo "TURN_SERVER_CREDENTIAL=$turn_password" >> global.env
    else
      sed_inplace "s/TURN_SERVER_CREDENTIAL=.*/TURN_SERVER_CREDENTIAL=$turn_password/g" global.env
    fi
    
    echo "✅ Created global.env"
  else
    echo "❌ global.env.template not found"
  fi

  # Create backend/.env from template
  if [ -f "backend/.env.template" ]; then
    cp backend/.env.template backend/.env
    sed_inplace "s/example.com/$domain_name/g" backend/.env
    sed_inplace "s/your_secure_password_here/$db_password/g" backend/.env
    sed_inplace "s/your_jwt_secret_here/$jwt_secret/g" backend/.env
    sed_inplace "s/your_secure_admin_password_here/$admin_password/g" backend/.env
    sed_inplace "s/your_ovenmedia_api_token_here/$ome_api_token/g" backend/.env
    # Add ADMIN_AUTH_SECRET if it exists in the template
    sed_inplace "s/your_admin_auth_secret_here/$admin_auth_secret/g" backend/.env
    
    # Add OME_WEBHOOK_SECRET if it doesn't exist
    if ! grep -q "OME_WEBHOOK_SECRET" backend/.env; then
      echo "OME_WEBHOOK_SECRET=$ome_webhook_secret" >> backend/.env
    else
      sed_inplace "s/OME_WEBHOOK_SECRET=.*/OME_WEBHOOK_SECRET=$ome_webhook_secret/g" backend/.env
    fi
    
    # Ensure OME_API_ACCESS_TOKEN is properly set with the correct name
    if ! grep -q "OME_API_ACCESS_TOKEN" backend/.env; then
      echo -e "\n# OvenMediaEngine API access" >> backend/.env
      echo "OME_API_ACCESS_TOKEN=$ome_api_token" >> backend/.env
    else
      sed_inplace "s/OME_API_ACCESS_TOKEN=.*/OME_API_ACCESS_TOKEN=$ome_api_token/g" backend/.env
    fi
    
    # Ensure OME_API_URL is properly set
    if ! grep -q "OME_API_URL" backend/.env; then
      echo "OME_API_URL=http://origin:8081" >> backend/.env
    else
      sed_inplace "s|OME_API_URL=.*|OME_API_URL=http://origin:8081|g" backend/.env
    fi
    
    # Remove any old variable names to prevent confusion
    if grep -q "OVENMEDIA_API_URL" backend/.env; then
      sed_inplace "/OVENMEDIA_API_URL/d" backend/.env
    fi
    
    if grep -q "OVENMEDIA_API_TOKEN" backend/.env; then
      sed_inplace "/OVENMEDIA_API_TOKEN/d" backend/.env
    fi
    
    echo "✅ Created backend/.env"
  else
    echo "❌ backend/.env.template not found"
  fi

  # Create frontend/.env from template
  if [ -f "frontend/.env.template" ]; then
    cp frontend/.env.template frontend/.env
    # Replace domain in all the frontend environment variables
    sed_inplace "s/live.colourstream.example.com/live.colourstream.$domain_name/g" frontend/.env
    sed_inplace "s/video.colourstream.example.com/video.colourstream.$domain_name/g" frontend/.env
    # Leave the OIDC endpoint as a placeholder until the user configures their actual OIDC provider
    echo "✅ Created frontend/.env"
  else
    echo "❌ frontend/.env.template not found"
  fi

  # Create mirotalk/.env from template
  if [ -f "mirotalk/.env.template" ]; then
    cp mirotalk/.env.template mirotalk/.env
    sed_inplace "s/example.com/$domain_name/g" mirotalk/.env
    sed_inplace "s/your_turn_password/$turn_password/g" mirotalk/.env
    sed_inplace "s/your_api_key_secret/$mirotalk_api_key/g" mirotalk/.env
    sed_inplace "s/your_mirotalk_api_key_here/$mirotalk_api_key/g" mirotalk/.env
    sed_inplace "s/your_jwt_key_here/$jwt_key/g" mirotalk/.env
    sed_inplace "s/TURN_SERVER_CREDENTIAL=your_turn_password/TURN_SERVER_CREDENTIAL=$turn_password/g" mirotalk/.env
    sed_inplace "s/globalUsername/admin/g" mirotalk/.env
    sed_inplace "s/globalPassword/$admin_password/g" mirotalk/.env
    echo "✅ Created mirotalk/.env"
  else
    echo "❌ mirotalk/.env.template not found"
  fi
  
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