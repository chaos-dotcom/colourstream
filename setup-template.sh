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
admin_auth_secret=$(generate_password)  # Added for ADMIN_AUTH_SECRET
mirotalk_api_key=$(generate_password)
turn_password=$(generate_password)
ome_api_token=$(generate_password)

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
  sed_inplace "s/your_jwt_secret_here/$jwt_key/g" backend/.env
  sed_inplace "s/your_secure_admin_password_here/$admin_password/g" backend/.env
  sed_inplace "s/your_ovenmedia_api_token_here/$ome_api_token/g" backend/.env
  # Add ADMIN_AUTH_SECRET if it exists in the template
  sed_inplace "s/your_admin_auth_secret_here/$admin_auth_secret/g" backend/.env
  
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

# Update docker-compose.yml with all the generated credentials for consistency
if [ -f "docker-compose.yml" ]; then
  # Update PostgreSQL password in docker-compose.yml
  sed_inplace "s/POSTGRES_PASSWORD: [a-f0-9]*/POSTGRES_PASSWORD: $db_password/g" docker-compose.yml
  sed_inplace "s|DATABASE_URL: \"postgresql://colourstream:[a-f0-9]*@|DATABASE_URL: \"postgresql://colourstream:$db_password@|g" docker-compose.yml
  
  # Update JWT Key in docker-compose.yml
  sed_inplace "s/JWT_KEY: [a-f0-9]*/JWT_KEY: $jwt_key/g" docker-compose.yml
  
  # Update ADMIN_AUTH_SECRET in docker-compose.yml
  sed_inplace "s/ADMIN_AUTH_SECRET: [a-f0-9]*/ADMIN_AUTH_SECRET: $admin_auth_secret/g" docker-compose.yml
  
  # Update OvenMediaEngine API Token - handle both possible variable names
  sed_inplace "s/OME_API_ACCESS_TOKEN: \"[a-f0-9]*\"/OME_API_ACCESS_TOKEN: \"$ome_api_token\"/g" docker-compose.yml
  sed_inplace "s/OVENMEDIA_API_TOKEN: \"[a-f0-9]*\"/OME_API_ACCESS_TOKEN: \"$ome_api_token\"/g" docker-compose.yml
  
  # Update any hardcoded tokens that might be in the file
  sed_inplace "s/0fc62ea62790ad7c/$ome_api_token/g" docker-compose.yml
  sed_inplace "s/41b20d4a33dcca381396b5b83053ef2f/$ome_api_token/g" docker-compose.yml
  
  # Update TURN Server Credential
  sed_inplace "s/TURN_SERVER_CREDENTIAL: \"[^\"]*\"/TURN_SERVER_CREDENTIAL: \"$turn_password\"/g" docker-compose.yml
  
  echo "✅ Updated all credentials in docker-compose.yml for consistency"
fi

# Create env.reference file in the root directory to document the configuration for reference
cat > env.reference << EOL
# Generated Configuration - $(date)
# THIS IS A REFERENCE FILE ONLY - NOT USED BY THE APPLICATION
# Keep this file secure as it contains sensitive credentials

DOMAIN_NAME=$domain_name
ADMIN_EMAIL=$admin_email
DB_PASSWORD=$db_password
JWT_KEY=$jwt_key
ADMIN_PASSWORD=$admin_password
ADMIN_AUTH_SECRET=$admin_auth_secret
MIROTALK_API_KEY=$mirotalk_api_key
TURN_PASSWORD=$turn_password
OME_API_TOKEN=$ome_api_token
FRONTEND_URL=https://live.colourstream.$domain_name
VIDEO_URL=https://video.colourstream.$domain_name
EOL

echo "✅ Created env.reference file with configuration summary"

# Remove any existing .env file to avoid confusion
if [ -f ".env" ]; then
  rm .env
  echo "ℹ️ Removed old .env file to avoid confusion"
fi

# Run cleanup after completing to remove any incorrectly named files
cleanup_quoted_files

echo
echo "Configuration Summary:"
echo "======================"
echo "Domain: $domain_name"
echo "Admin Email: $admin_email"
echo "Database Password: $db_password"
echo "JWT Key: $jwt_key"
echo "Admin Password: $admin_password"
echo "Admin Auth Secret: $admin_auth_secret"
echo "MiroTalk API Key: $mirotalk_api_key"
echo "TURN Server Password: $turn_password"
echo "OvenMediaEngine API Token: $ome_api_token"
echo
echo "Frontend URL: https://live.colourstream.$domain_name"
echo "Video URL: https://video.colourstream.$domain_name"
echo
echo "Next Steps:"
echo "1. Review and further customize the configuration files if needed"
echo "2. Set up SSL certificates for your domains"
echo "3. Configure your DNS to point the subdomains to your server"
echo "4. Start the application with: docker-compose up -d"
echo
echo "For more information, see TEMPLATE_README.md"