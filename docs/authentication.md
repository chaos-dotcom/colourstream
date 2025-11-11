# Authentication System

## Overview

ColourStream uses a modern, secure authentication system that prioritizes passkey (WebAuthn) authentication over traditional password-based authentication. This system is designed to provide both security and convenience while encouraging the use of biometric authentication methods.

## Authentication Methods

### 1. Passkey Authentication (Recommended)
- Uses the WebAuthn standard for passwordless authentication
- Supports biometric authentication (fingerprint, face recognition)
- Device-based security using platform authenticators
- Once set up, becomes the primary authentication method

### 2. Password Authentication (Initial Setup Only)
- Available only when no passkeys are registered
- Used for initial admin access
- Automatically disabled once passkeys are registered
- Can be re-enabled only by removing all passkeys

## Security Features

### Passkey-First Approach
- When passkeys exist, password authentication is automatically disabled
- Password login attempts are rejected if passkeys are registered
- System enforces passkey usage once configured

### Password Management
- Initial admin password is configurable via `ADMIN_PASSWORD` in `.env`
- Password authentication is disabled when:
  1. Passkeys are registered, OR
  2. `ADMIN_PASSWORD` is empty in `.env`
- Password can be removed after passkey setup

### WebAuthn Configuration
```env
# WebAuthn Configuration in .env
WEBAUTHN_RP_ID=live.colourstream.colourbyrogers.co.uk
WEBAUTHN_ORIGIN=https://live.colourstream.colourbyrogers.co.uk
```

## Setup Process

### Initial Access
1. Set `ADMIN_PASSWORD` in `.env` for first-time access
2. Log in using the password
3. Register a passkey when prompted

### Registering Passkeys
1. Navigate to the Admin Dashboard
2. Look for the "Passkey Management" section
3. Click "Register Passkey"
4. Follow browser prompts for biometric/PIN setup

### Removing Password Authentication
1. Ensure at least one passkey is registered
2. Go to Admin Dashboard
3. Click "Remove Password Authentication"
4. System will switch to passkey-only mode

## Security Recommendations

1. Register at least two passkeys:
   - Primary device passkey
   - Backup device passkey
2. Remove password authentication after passkey setup
3. Keep `ADMIN_PASSWORD` empty in production to enforce passkey usage

## Technical Details

### Database Schema
```prisma
model WebAuthnCredential {
  id              String   @id @default(uuid())
  credentialId    String   @unique
  publicKey       String
  counter         BigInt
  userId          String   @unique // Single admin user
  transports      String?  // JSON string of allowed transports
  createdAt       DateTime @default(now())
  lastUsed        DateTime @default(now())
}
```

### Authentication Flow
1. System checks for registered passkeys
2. If passkeys exist:
   - Force passkey authentication
   - Reject password attempts
3. If no passkeys:
   - Check `ADMIN_PASSWORD` setting
   - Allow password login if set
   - Force passkey setup if empty

### Security Constraints
- Cannot remove the last passkey when password auth is disabled
- Cannot remove password auth without at least one passkey
- Cannot register duplicate passkeys

## Troubleshooting

### Common Issues
1. **Cannot Log In with Password**
   - Check if passkeys are registered (password login will be disabled)
   - Verify `ADMIN_PASSWORD` is set in `.env` (if no passkeys)

2. **Passkey Registration Failed**
   - Ensure browser supports WebAuthn
   - Check domain configuration matches `WEBAUTHN_RP_ID`
   - Verify HTTPS is properly configured

3. **Cannot Remove Password Authentication**
   - Verify at least one passkey is registered
   - Check if you're properly authenticated

### Recovery Process
If locked out:
1. Access the database directly
2. Clear the WebAuthnCredential table
3. Set `ADMIN_PASSWORD` in `.env`
4. Restart the authentication process 