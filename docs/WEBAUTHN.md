# WebAuthn Authentication Setup

## Overview
This system uses WebAuthn (passkeys) for secure authentication. It supports both password and passkey authentication, with the ability to transition to passkey-only mode for enhanced security.

## Initial Setup

### 1. Environment Configuration
Create or modify your `.env` file with these required variables:
```env
# Required for initial setup - REMOVE AFTER PASSKEY REGISTRATION
ADMIN_PASSWORD=admin

# WebAuthn Configuration
WEBAUTHN_RP_ID=live.colourstream.colourbyrogers.co.uk
WEBAUTHN_ORIGIN=https://live.colourstream.colourbyrogers.co.uk
```

### 2. Database Configuration
The WebAuthn credentials are stored in a SQLite database. The configuration is handled through Docker:

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - DATABASE_URL=file:/app/data/db.sqlite
    volumes:
      - ./data:/app/data
```

The database will persist between container rebuilds in the `./data` directory.

## Authentication Flow

### Initial Login
1. On first deployment, use the default admin password from your `.env` file
2. Log in to the admin dashboard
3. Navigate to the Security tab
4. Register at least one passkey before removing password authentication

### Registering Passkeys
1. Click "Register New Passkey" in the Security tab
2. Follow your browser's prompts to register the passkey
3. The passkey will be stored securely in the database
4. You can register multiple passkeys for backup purposes

### Transitioning to Passkey-Only Mode
Once you have registered at least one passkey, you can:

1. Remove password authentication:
   - Click "Remove Password Authentication" in the Security tab
   - This will remove the `ADMIN_PASSWORD` from your `.env` file
   - The system will automatically switch to passkey-only mode

2. The system automatically detects passkey-only mode:
   - When `ADMIN_PASSWORD` is empty or removed from `.env`
   - No additional configuration needed

### Security Recommendations
1. Register at least two passkeys before removing password authentication
2. Store passkeys on separate devices for backup
3. Remove the `ADMIN_PASSWORD` from your `.env` file after setting up passkeys

## Post-Setup Configuration

### Clean .env File
After setting up passkeys, you can remove these variables from your `.env`:
```env
# REMOVE AFTER SETUP
ADMIN_PASSWORD=admin  # Remove to enable passkey-only mode
```

## Managing Passkeys

### Viewing Registered Passkeys
- Navigate to Security tab
- View list of registered passkeys
- Each passkey shows its last used timestamp

### Removing Passkeys
- Click the delete icon next to a passkey
- Cannot remove the last passkey if password authentication is disabled
- Requires authentication to remove

## Troubleshooting

### Database Persistence
- Passkey data is stored in `./data/db.sqlite`
- The database persists between container rebuilds
- Verify persistence with:
  ```bash
  docker-compose exec backend sqlite3 /app/data/db.sqlite "SELECT COUNT(*) FROM WebAuthnCredential;"
  ```

### Common Issues
1. **404 Error on Authentication**
   - Ensure WebAuthn origins match your domain
   - Check WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN in .env

2. **Cannot Remove Password**
   - Ensure at least one passkey is registered
   - Verify passkey works before removing password

3. **Lost Access**
   - Keep ADMIN_PASSWORD in .env until passkeys are confirmed working
   - Register multiple passkeys on different devices
   - Test passkey login before removing password authentication

## Docker Commands

### Checking Passkey Status
```bash
# View registered passkeys
docker-compose exec backend sqlite3 /app/data/db.sqlite \
  "SELECT id, userId, createdAt, lastUsed FROM WebAuthnCredential;"

# Verify database persistence
docker-compose down && docker-compose up -d
```

### Rebuilding with New Configuration
```bash
# Rebuild backend with new configuration
docker-compose up -d --build backend

# View logs for troubleshooting
docker-compose logs backend
``` 