#!/bin/bash

# ColourStream Template Setup Script
# This script helps initialize configuration files from templates

echo "ColourStream Template Setup"
echo "=========================="
echo

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
mirotalk_api_key=$(generate_password)
turn_password=$(generate_password)
ome_api_token=$(generate_password)

echo
echo "Creating configuration files..."

# Create docker-compose.yml from template
if [ -f "docker-compose.template.yml" ]; then
  cp docker-compose.template.yml docker-compose.yml
  sed -i "s/example.com/$domain_name/g" docker-compose.yml
  sed -i "s/admin@example.com/$admin_email/g" docker-compose.yml
  sed -i "s/--certificatesresolvers.myresolver.acme.email=admin@johnrogerscolour.co.uk/--certificatesresolvers.myresolver.acme.email=$admin_email/g" docker-compose.yml
  echo "✅ Created docker-compose.yml"
else
  echo "❌ docker-compose.template.yml not found"
fi

# Create global.env from template
if [ -f "global.env.template" ]; then
  cp global.env.template global.env
  sed -i "s/example.com/$domain_name/g" global.env
  sed -i "s/your_secure_password_here/$db_password/g" global.env
  sed -i "s/your_jwt_key_here/$jwt_key/g" global.env
  sed -i "s/your_mirotalk_api_key_here/$mirotalk_api_key/g" global.env
  echo "✅ Created global.env"
else
  echo "❌ global.env.template not found"
fi

# Create backend/.env from template
if [ -f "backend/.env.template" ]; then
  cp backend/.env.template backend/.env
  sed -i "s/example.com/$domain_name/g" backend/.env
  sed -i "s/your_secure_password_here/$db_password/g" backend/.env
  sed -i "s/your_jwt_secret_here/$jwt_key/g" backend/.env
  sed -i "s/your_secure_admin_password_here/$admin_password/g" backend/.env
  sed -i "s/your_ovenmedia_api_token_here/$ome_api_token/g" backend/.env
  echo "✅ Created backend/.env"
else
  echo "❌ backend/.env.template not found"
fi

# Create mirotalk/.env from template
if [ -f "mirotalk/.env.template" ]; then
  cp mirotalk/.env.template mirotalk/.env
  sed -i "s/example.com/$domain_name/g" mirotalk/.env
  sed -i "s/your_turn_password/$turn_password/g" mirotalk/.env
  sed -i "s/your_api_key_secret/$mirotalk_api_key/g" mirotalk/.env
  sed -i "s/your_mirotalk_api_key_here/$mirotalk_api_key/g" mirotalk/.env
  sed -i "s/your_jwt_key_here/$jwt_key/g" mirotalk/.env
  sed -i "s/TURN_SERVER_CREDENTIAL=your_turn_password/TURN_SERVER_CREDENTIAL=$turn_password/g" mirotalk/.env
  sed -i "s/globalUsername/admin/g" mirotalk/.env
  sed -i "s/globalPassword/$admin_password/g" mirotalk/.env
  echo "✅ Created mirotalk/.env"
else
  echo "❌ mirotalk/.env.template not found"
fi

echo
echo "Configuration Summary:"
echo "======================"
echo "Domain: $domain_name"
echo "Admin Email: $admin_email"
echo "Database Password: $db_password"
echo "JWT Key: $jwt_key"
echo "Admin Password: $admin_password"
echo "MiroTalk API Key: $mirotalk_api_key"
echo "TURN Server Password: $turn_password"
echo "OvenMediaEngine API Token: $ome_api_token"
echo
echo "Next Steps:"
echo "1. Review and further customize the configuration files if needed"
echo "2. Set up SSL certificates for your domains"
echo "3. Configure your DNS to point the subdomains to your server"
echo "4. Start the application with: docker-compose up -d"
echo
echo "For more information, see TEMPLATE_README.md" 