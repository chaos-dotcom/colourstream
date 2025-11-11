#!/bin/bash
#
# Certificate Renewal Script for ColourStream
# This script extracts certificates from Traefik's acme.json and updates
# certificates for origin, edge, mirotalk, and coturn services
#

set -e  # Exit on error

# Configuration variables with relative paths
ACME_JSON="mnt/SSDPool/homes/john/traefik/traefik/sslcerts/acme.json"
CERT_DIR="../certs"

# Create certificate directories if they don't exist
mkdir -p "${CERT_DIR}/certs"
mkdir -p "${CERT_DIR}/private"

# Clean out any existing certificates
echo "Cleaning existing certificates..."
rm -rf "${CERT_DIR}/certs/"*
rm -rf "${CERT_DIR}/private/"*
echo "Certificate directories cleaned."

echo "===== Certificate Renewal Process Started ====="
echo "$(date)"
echo "Extracting certificates from Traefik acme.json..."

# Use the dumpcerts script to extract all certificates
./dumpcerts.traefik.v2.sh "${ACME_JSON}" "${CERT_DIR}"

if [ $? -ne 0 ]; then
  echo "Error: Failed to extract certificates from acme.json"
  exit 1
fi

echo "Certificates extracted successfully!"

# Process all certificate files found in the output directory
echo "Processing extracted certificates..."
CERT_COUNT=0

for CERT_FILE in "${CERT_DIR}/certs/"*.crt; do
  # Skip if no files were found
  if [[ ! -f "$CERT_FILE" ]]; then
    echo "No certificate files found."
    break
  fi
  
  # Extract domain name from filename
  DOMAIN=$(basename "$CERT_FILE" .crt)
  echo "Setting up certificates for ${DOMAIN}..."
  
  # Verify that we have the key file as well
  if [ ! -f "${CERT_DIR}/private/${DOMAIN}.key" ]; then
    echo "Warning: Private key for ${DOMAIN} not found. Skipping..."
    continue
  fi
  
  # Create a symlink with .pem extension for compatibility
  ln -sf "${CERT_DIR}/certs/${DOMAIN}.crt" "${CERT_DIR}/certs/${DOMAIN}.pem"
  ln -sf "${CERT_DIR}/private/${DOMAIN}.key" "${CERT_DIR}/private/${DOMAIN}.pem"
  
  echo "Certificate for ${DOMAIN} processed successfully."
  CERT_COUNT=$((CERT_COUNT + 1))
done

echo "Processed $CERT_COUNT certificates."

echo "All certificates processed. Now updating services..."

# Navigate to the parent directory to run docker-compose commands
cd ..

# Update services with new certificates

# 1. Update Origin service
echo "Updating Origin service..."
docker compose stop origin
docker compose up -d origin
echo "Origin service updated."

# 2. Update Edge service (if it exists)
if docker-compose ps | grep -q "edge"; then
  echo "Updating Edge service..."
  docker compose stop edge
  docker compose up -d edge
  echo "Edge service updated."
else
  echo "Edge service not found, skipping..."
fi

# 3. Update Mirotalk service (if it exists)
if docker-compose ps | grep -q "mirotalk"; then
  echo "Updating Mirotalk service..."
  docker compose stop mirotalk
  docker compose up -d mirotalk
  echo "Mirotalk service updated."
else
  echo "Mirotalk service not found, skipping..."
fi

# 4. Update Coturn service (if it exists)
if docker compose ps | grep -q "coturn"; then
  echo "Updating Coturn service..."
  docker compose stop coturn
  docker compose up -d coturn
  echo "Coturn service updated."
else
  echo "Coturn service not found, skipping..."
fi

echo "===== Certificate Renewal Process Completed ====="
echo "$(date)"
echo ""
echo "Note: This process needs to be repeated every 90 days before certificates expire."
echo "Consider setting up a cron job to automate this process."
echo "Suggested cron entry (runs every 60 days):"
echo "0 0 1 */2 * cd /path/to/colourstream && ./setup/renew_certificates.sh >> ./logs/cert_renewal.log 2>&1" 