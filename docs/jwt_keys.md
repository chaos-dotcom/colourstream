# JWT Key Configuration

This document explains the JWT key configuration in the ColourStream application.

## Overview

JWT (JSON Web Token) keys are used for authentication and secure communication between different services in the ColourStream application. We use a simplified approach with a single source of truth for JWT keys.

## Key JWT Variables

The following JWT key is used in the ColourStream application:

| Variable Name | Description |
|---------------|-------------|
| `JWT_KEY` | Standard JWT key used for authentication between ColourStream and MiroTalk |

## Implementation Details

### In global.env

```
# Security Keys
JWT_KEY=your-jwt-secret-key-here  # Used for backend user authentication
JWT_KEY=your-mirotalk-jwt-key                     # Used for MiroTalk integration
```

### In mirotalk/.env

```
# JWT Configuration
JWT_KEY=${JWT_KEY}  # References the JWT_KEY from global.env
```

## Usage in Code

### In backend/src/routes/rooms.ts

The `generateMiroTalkToken` function uses `JWT_KEY` to create tokens for MiroTalk authentication:

```typescript
const generateMiroTalkToken = async (
  roomId: string, 
  expiryDays?: number, 
  customUsername?: string, 
  customPassword?: string
): Promise<string> => {
  try {
    if (!process.env.JWT_KEY) {
      throw new Error('JWT_KEY environment variable is not set');
    }
    
    // Use the standard JWT_KEY
    const JWT_KEY = process.env.JWT_KEY;
    
    // Format username as expected by MiroTalk - use custom if provided, otherwise use room_roomId
    const username = customUsername || `room_${roomId}`;
    
    // Get password from custom parameter, environment, or use default
    let password = customPassword;
    if (!password) {
      password = process.env.HOST_USERS ? 
        JSON.parse(process.env.HOST_USERS)[0].password : 
        'globalPassword';
    }

    // Set expiration to match room expiry (default to 30 days if not specified)
    const expireDays = expiryDays || 30;
    const expireValue = `${expireDays}d`;

    // Constructing payload - MiroTalk expects presenter as a string "true" or "1"
    const payload = {
      username: username,
      password: password,
      presenter: "true", // MiroTalk expects "true" or "1" as a string
      expire: expireValue  // Match room expiration
    };

    // Encrypt payload using AES encryption
    const payloadString = JSON.stringify(payload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, JWT_KEY).toString();

    // Constructing JWT token with expiration matching room expiry
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      JWT_KEY,
      { expiresIn: `${expireDays}d` } // Use room expiry
    );

    return jwtToken;
  } catch (error) {
    logger.error('Error generating MiroTalk token:', error);
    throw new AppError(500, 'Failed to generate MiroTalk token');
  }
};
```

### In backend/src/routes/mirotalk.ts

The MiroTalk routes use `JWT_KEY` for token generation and verification:

```typescript
// Create MiroTalk meeting URL
router.post('/join', authenticateToken, async (req: Request<{}, {}, MiroTalkJoinRequest>, res: Response, next: NextFunction) => {
  try {
    // ...
    if (!process.env.JWT_KEY) {
      throw new AppError(500, 'JWT_KEY environment variable is not set');
    }
    
    // Encrypt payload using AES
    const payloadString = JSON.stringify(tokenPayload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, process.env.JWT_KEY).toString();

    // Create JWT token
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      process.env.JWT_KEY || '',
      { expiresIn: expireInSeconds }
    );
    // ...
  } catch (error) {
    next(error);
  }
});
```

### In backend/src/test-mirotalk.ts

The test script uses `JWT_KEY` for token generation and testing:

```typescript
// API Settings from MiroTalk .env file
const API_KEY_SECRET = process.env.MIROTALK_API_KEY_SECRET || 'MIROTALK_API_SECRET_KEY_2024';
const JWT_KEY = process.env.JWT_KEY || 'MIROTALK_JWT_SECRET_KEY_2024';
```

## Benefits of This Approach

1. **Simplicity**: A single source of truth for JWT keys
2. **Consistency**: All services reference the same key
3. **Maintainability**: Easier to update or rotate keys
4. **Reduced Errors**: No risk of keys getting out of sync

## Security Considerations

- Always use strong, unique values for JWT keys
- Store these keys securely in environment variables
- Never commit actual key values to version control
- Rotate keys periodically for enhanced security 