#!/bin/sh
set -e

# Create runtime config directory if it doesn't exist
mkdir -p /app/build/config

# Create the runtime configuration from environment variables
cat > /app/build/config/runtime-config.js << EOF
window.RUNTIME_CONFIG = {
  API_URL: "${VITE_API_URL}",
  OIDC_AUTH_ENDPOINT: "${VITE_OIDC_AUTH_ENDPOINT}",
  WEBRTC_WS_HOST: "${VITE_WEBRTC_WS_HOST}",
  WEBRTC_WS_PORT: "${VITE_WEBRTC_WS_PORT}",
  WEBRTC_WS_PROTOCOL: "${VITE_WEBRTC_WS_PROTOCOL}",
  WEBRTC_APP_PATH: "${VITE_WEBRTC_APP_PATH}",
  VIDEO_URL: "${VITE_VIDEO_URL}",
  OVENPLAYER_SCRIPT_URL: "${VITE_OVENPLAYER_SCRIPT_URL}",
  UPLOAD_ENDPOINT_URL: "${VITE_UPLOAD_ENDPOINT_URL}",
  NAMEFORUPLOADCOMPLETION: "${VITE_NAMEFORUPLOADCOMPLETION}",
  S3_ENDPOINT: "${VITE_S3_ENDPOINT}",
  S3_REGION: "${VITE_S3_REGION}",
  S3_BUCKET: "${VITE_S3_BUCKET}",
  COMPANION_URL: "${VITE_COMPANION_URL}",
  COMPANION_AWS_ENDPOINT: "${VITE_COMPANION_AWS_ENDPOINT}",
  USE_COMPANION: "${VITE_USE_COMPANION}",
  ENABLE_DROPBOX: "${VITE_ENABLE_DROPBOX}",
  ENABLE_GOOGLE_DRIVE: "${VITE_ENABLE_GOOGLE_DRIVE}",
  GOOGLE_DRIVE_CLIENT_ID: "${VITE_GOOGLE_DRIVE_CLIENT_ID}",
  GOOGLE_DRIVE_API_KEY: "${VITE_GOOGLE_DRIVE_API_KEY}",
  GOOGLE_DRIVE_APP_ID: "${VITE_GOOGLE_DRIVE_APP_ID}"
};
console.log("Runtime configuration loaded:", window.RUNTIME_CONFIG);
EOF

echo "Generated runtime configuration:"
cat /app/build/config/runtime-config.js

# Inject the runtime config script into the HTML
# Find all HTML files and add script reference
for htmlfile in /app/build/*.html; do
  if [ -f "$htmlfile" ]; then
    # Add the runtime-config.js script before the first script tag
    awk '
      {
        if (/<\/head>/ && !added) {
          print "    <script src=\"/config/runtime-config.js\"></script>";
          added = 1;
        }
        print $0;
      }
    ' "$htmlfile" > "${htmlfile}.tmp" && mv "${htmlfile}.tmp" "$htmlfile"
    
    echo "Injected runtime config into $htmlfile"
  fi
done

# Start the server
echo "Starting server..."
exec serve -s build -l 3000 --single 