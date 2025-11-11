import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
import { loginLimiter, trackLoginAttempts } from '../middleware/security';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import base64url from 'base64url';
import { 
  getOIDCConfig, 
  updateOIDCConfigInDB
} from '../services/oidc-express';
import { requiresAuth } from 'express-openid-connect';

const router = express.Router();

// WebAuthn configuration
const rpName = 'ColourStream Admin';
const rpID = process.env.WEBAUTHN_RP_ID || 'live.colourstream.colourbyrogers.co.uk';
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

// Store challenge temporarily (in production, use Redis or similar)
let currentChallenge: string | undefined;

// Helper function to convert Uint8Array to base64url string
function uint8ArrayToBase64url(array: Uint8Array): string {
  return base64url.encode(Buffer.from(array));
}

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint): number {
  const number = Number(value);
  if (number > Number.MAX_SAFE_INTEGER) {
    throw new Error('Counter value too large');
  }
  return number;
}

// OIDC configuration endpoint
router.get('/oidc/config', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getOIDCConfig();
    
    res.json({
      status: 'success',
      data: config
    });
  } catch (error) {
    next(error);
  }
});

// Update OIDC configuration
router.post('/oidc/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = req.body;
    
    // If client secret is not provided or is masked, keep the existing one
    if (!config.clientSecret || config.clientSecret === '********') {
      const existingConfig = await getOIDCConfig();
      if (existingConfig && existingConfig.config) {
        // Access the client secret from the existing config
        const existingOIDCConfig = await prisma.oIDCConfig.findUnique({
          where: { id: 'default' },
        });
        
        if (existingOIDCConfig && existingOIDCConfig.clientSecret) {
          config.clientSecret = existingOIDCConfig.clientSecret;
        }
      }
    }
    
    const updatedConfig = await updateOIDCConfigInDB(config);
    
    res.json({
      status: 'success',
      data: updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

// OIDC profile endpoint - returns user info from the OIDC provider
router.get('/oidc/profile', requiresAuth(), (req: Request, res: Response) => {
  res.json({
    status: 'success',
    data: {
      user: req.oidc.user
    }
  });
});

// OIDC token endpoint - generates a JWT token for the authenticated user
router.get('/oidc/token', requiresAuth(), (req: Request, res: Response) => {
  try {
    // Check if user info contains required fields
    if (!req.oidc.user || !req.oidc.user.sub) {
      logger.error('Invalid user info from OIDC provider', { userInfo: req.oidc.user });
      throw new AppError(400, 'Invalid user info from OIDC provider');
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: 'admin', 
        type: 'admin',
        oidc: {
          sub: req.oidc.user.sub,
          provider: req.oidc.user.iss
        }
      },
      process.env.ADMIN_AUTH_SECRET!,
      { expiresIn: '7d' }
    );
    
    logger.info('Generated JWT token for OIDC user', {
      sub: req.oidc.user.sub
    });
    
    res.json({
      status: 'success',
      data: {
        token,
        user: req.oidc.user
      }
    });
  } catch (error: any) {
    logger.error('Error generating token', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate token'
    });
  }
});

// OIDC token URL fix (public endpoint for quick fix)
router.post('/oidc/fix-token-url-public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Get discovery document to get the real token URL
    const discoveryResponse = await fetch('https://sso.shed.gay/.well-known/openid-configuration');
    if (!discoveryResponse.ok) {
      throw new AppError(500, 'Failed to fetch OIDC discovery document');
    }
    
    const discovery = await discoveryResponse.json();
    const tokenUrl = discovery.token_endpoint;
    const userInfoUrl = discovery.userinfo_endpoint;
    
    logger.info('Retrieved token and userinfo URLs from discovery document', {
      tokenUrl,
      userInfoUrl
    });
    
    // Update the OIDC config in the database
    const updatedConfig = await prisma.oIDCConfig.update({
      where: { id: 'default' },
      data: {
        tokenUrl,
        userInfoUrl
      }
    });
    
    logger.info('Updated OIDC configuration with correct token and userinfo URLs', {
      tokenUrl: updatedConfig.tokenUrl,
      userInfoUrl: updatedConfig.userInfoUrl
    });
    
    res.json({
      status: 'success',
      message: 'Updated OIDC configuration with correct token and userinfo URLs',
      data: {
        tokenUrl: updatedConfig.tokenUrl,
        userInfoUrl: updatedConfig.userInfoUrl
      }
    });
  } catch (error: any) {
    logger.error('Error fixing OIDC token URL', {
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
});

// OIDC token exchange endpoint - exchanges authorization code for token
router.post('/oidc/token-exchange', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, redirectUri } = req.body;
    
    if (!code) {
      logger.error('Missing authorization code in token exchange request');
      throw new AppError(400, 'Missing authorization code');
    }
    
    logger.info('Processing OIDC token exchange request', { 
      hasCode: !!code, 
      redirectUri
    });
    
    // Get the OIDC configuration
    const config = await prisma.oIDCConfig.findUnique({
      where: { id: 'default' },
    });
    
    if (!config || !config.enabled || !config.clientId || !config.clientSecret) {
      logger.error('OIDC not properly configured - missing basic config');
      throw new AppError(500, 'OIDC configuration is missing or invalid');
    }
    
    // Check if we're using SSO.shed.gay and apply hardcoded fixes for known URLs
    let tokenUrl = config.tokenUrl;
    let userInfoUrl = config.userInfoUrl;
    
    // If the discoveryUrl contains sso.shed.gay, we know the correct endpoints
    if (config.discoveryUrl && config.discoveryUrl.includes('sso.shed.gay')) {
      tokenUrl = 'https://sso.shed.gay/api/oidc/token';
      userInfoUrl = 'https://sso.shed.gay/api/oidc/userinfo';
      logger.info('Using hardcoded SSO.shed.gay token and userinfo URLs', { tokenUrl, userInfoUrl });
    } else if (!tokenUrl && config.discoveryUrl) {
      logger.info('Token URL not configured, deriving from discovery URL', { discoveryUrl: config.discoveryUrl });
      tokenUrl = `${config.discoveryUrl.replace(/\/$/, '')}/token`;
    } else if (!tokenUrl && config.authorizationUrl) {
      // If we have an authorization URL, try to derive the token URL from it
      logger.info('Token URL not configured, deriving from authorization URL', { authorizationUrl: config.authorizationUrl });
      const baseUrl = config.authorizationUrl.split('/').slice(0, -1).join('/');
      tokenUrl = `${baseUrl}/token`;
    }
    
    if (!userInfoUrl && config.discoveryUrl) {
      // Same logic for userinfo URL
      logger.info('UserInfo URL not configured, deriving from discovery URL', { discoveryUrl: config.discoveryUrl });
      userInfoUrl = `${config.discoveryUrl.replace(/\/$/, '')}/userinfo`;
    } else if (!userInfoUrl && config.authorizationUrl) {
      // If we have an authorization URL, try to derive the userinfo URL from it
      logger.info('UserInfo URL not configured, deriving from authorization URL', { authorizationUrl: config.authorizationUrl });
      const baseUrl = config.authorizationUrl.split('/').slice(0, -1).join('/');
      userInfoUrl = `${baseUrl}/userinfo`;
    }
    
    // If we still don't have valid URLs, we can't proceed
    if (!tokenUrl) {
      logger.error('Missing token URL in OIDC configuration');
      throw new AppError(500, 'Missing token URL in OIDC configuration');
    }
    
    logger.info('Using token URL for code exchange', { tokenUrl });
    
    // Create form data for token request
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', config.clientId);
    params.append('client_secret', config.clientSecret);
    params.append('code', code);
    params.append('redirect_uri', redirectUri || `${process.env.PUBLIC_URL}/api/auth/oidc/callback`);
    
    // Exchange the code for a token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': process.env.PUBLIC_URL || 'https://live.colourstream.colourbyrogers.co.uk',
        'Referer': process.env.PUBLIC_URL || 'https://live.colourstream.colourbyrogers.co.uk',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: params.toString(),
    });
    
    if (!tokenResponse.ok) {
      let errorMessage = `Token endpoint error: ${tokenResponse.statusText}`;
      try {
        const errorData = await tokenResponse.text();
        logger.error('Token endpoint returned error', { 
          status: tokenResponse.status, 
          statusText: tokenResponse.statusText,
          error: errorData
        });
        errorMessage = `Token endpoint error: ${errorData}`;
      } catch (e) {
        logger.error('Failed to parse token endpoint error response');
      }
      throw new AppError(tokenResponse.status, errorMessage);
    }
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      logger.error('No access token in response', { tokenData });
      throw new AppError(500, 'No access token received from token endpoint');
    }
    
    logger.info('Successfully exchanged code for token');
    
    // If we don't have a userinfo URL, we'll skip that step and just use the token data
    if (!userInfoUrl) {
      logger.warn('Missing userInfoUrl in OIDC configuration, skipping user info retrieval');
      
      // Use token claims directly if possible
      const sub = tokenData.sub || 'unknown';
      
      // Generate JWT token for the user
      const token = jwt.sign(
        { 
          userId: 'admin', 
          type: 'admin',
          oidc: {
            sub,
            provider: config.providerName
          }
        },
        process.env.ADMIN_AUTH_SECRET!,
        { expiresIn: '7d' }
      );
      
      logger.info('Generated JWT token for OIDC user from token data');
      
      res.json({
        status: 'success',
        data: {
          token,
          user: {
            sub,
            ...tokenData
          }
        }
      });
      return;
    }
    
    // Get user info using the token
    logger.info('Fetching user info from', { userInfoUrl });
    const userInfoResponse = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!userInfoResponse.ok) {
      logger.error('Error fetching user info', { 
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText
      });
      throw new AppError(userInfoResponse.status, 'Failed to fetch user info');
    }
    
    const userInfo = await userInfoResponse.json();
    
    if (!userInfo.sub) {
      logger.error('Missing sub in user info response', { userInfo });
      throw new AppError(500, 'Invalid user info response');
    }
    
    // Generate JWT token for the user
    const token = jwt.sign(
      { 
        userId: 'admin', 
        type: 'admin',
        oidc: {
          sub: userInfo.sub,
          provider: config.providerName
        }
      },
      process.env.ADMIN_AUTH_SECRET!,
      { expiresIn: '7d' }
    );
    
    logger.info('Generated JWT token for OIDC user', {
      sub: userInfo.sub
    });
    
    res.json({
      status: 'success',
      data: {
        token,
        user: userInfo
      }
    });
  } catch (error: any) {
    logger.error('Error in OIDC token exchange', {
      error: error.message,
      stack: error.stack
    });
    // Track failed login attempt
    await trackLoginAttempts(req, res, () => next(error));
  }
});

// WebAuthn registration endpoint
// This endpoint handles both first-time setup and adding new passkeys.
// It's unauthenticated, but we perform a check to see if passkeys already exist.
// If they do, we only allow registration if a valid JWT is present (i.e., user is logged in).
router.post('/webauthn/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = 'admin';

        const existingCredentials = await prisma.webAuthnCredential.findMany({
            where: { userId: userId }
        });

        // If passkeys exist, we must ensure the user is authenticated to add another one.
        if (existingCredentials.length > 0) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // No token, but passkeys exist. This is the "setup already done" case.
                throw new AppError(400, 'Passkey already registered');
            }
            const token = authHeader.split(' ')[1];
            try {
                jwt.verify(token, process.env.ADMIN_AUTH_SECRET!);
                // Token is valid, proceed.
            } catch (error) {
                // Invalid token.
                throw new AppError(401, 'Invalid or expired token.');
            }
        }
        
        logger.info(`Starting passkey registration process for user: ${userId}`, {
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });

        logger.info(`Checking existing passkeys for user: ${userId}`, {
            count: existingCredentials.length,
            lastUsed: existingCredentials[0]?.lastUsed || null
        });

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: userId, // Use the determined userId
            userName: userId, // Use the determined userId
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform'
            }
        });

        // Store challenge
        currentChallenge = options.challenge;

        logger.info('Generated registration options', {
            rpID,
            origin,
            challenge: currentChallenge,
            hasChallenge: !!currentChallenge
        });

        res.json(options);
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error('Error in passkey registration:', {
                error: error.message,
                stack: error.stack,
                type: error.constructor.name
            });
        } else {
            logger.error('Unknown error in passkey registration:', error);
        }
        next(error);
    }
});

// WebAuthn registration verification endpoint
// Removed authenticateToken middleware to allow verification without prior login
router.post('/webauthn/register/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Identify the user - assuming 'admin' for now in this flow
    const userId = 'admin'; 
    
    logger.info(`Starting passkey registration verification for user: ${userId}`);

    if (!currentChallenge) {
      logger.error('No challenge found for verification');
      throw new AppError(400, 'Registration challenge not found');
    }

    logger.info('Verifying registration response', {
      challenge: currentChallenge,
      origin,
      rpID
    });

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      logger.info('Registration verified successfully, creating credential record');

      const credentialIdString = uint8ArrayToBase64url(credentialID);
      const publicKeyString = uint8ArrayToBase64url(credentialPublicKey);

      // Check if this specific credential already exists
      const existingCredential = await prisma.webAuthnCredential.findFirst({
        where: {
          credentialId: credentialIdString,
          userId: userId // Ensure we check for the correct user
        }
      });

      if (existingCredential) {
        logger.warn(`Credential already exists for user ${userId}`, { credentialId: credentialIdString });
        throw new AppError(400, 'This passkey is already registered');
      }

      // Ensure transports is stored as a valid JSON string
      let transportsJson = null;
      if (req.body.response.transports) {
        // If it's already an array, stringify it
        if (Array.isArray(req.body.response.transports)) {
          transportsJson = JSON.stringify(req.body.response.transports);
        } 
        // If it's a string but not JSON, convert it to an array and stringify
        else if (typeof req.body.response.transports === 'string') {
          try {
            // Try parsing it first in case it's already JSON
            JSON.parse(req.body.response.transports);
            transportsJson = req.body.response.transports;
          } catch (e) {
            // If parsing fails, treat it as a single transport
            transportsJson = JSON.stringify([req.body.response.transports]);
          }
        }
      }

      await prisma.webAuthnCredential.create({
        data: {
          credentialId: credentialIdString,
          publicKey: publicKeyString,
          counter: counter,
          userId: userId, // Use the determined userId
          transports: transportsJson
        }
      });

      logger.info(`Passkey registered successfully for user: ${userId}`);

      // Generate a token upon successful registration verification if needed
      // This depends on whether the user should be logged in immediately after registration
      // For the /setup-passkey flow, generating a token might be desired.
      const token = jwt.sign(
        { userId: userId, type: 'admin' }, // Use the determined userId
        process.env.ADMIN_AUTH_SECRET!,
        { expiresIn: '7d' }
      );

      res.json({ 
        status: 'success',
        message: 'Passkey registered successfully',
        verified: true,
        data: { token } // Optionally return the token
      });
    } else {
      logger.error('Registration verification failed');
      throw new AppError(400, 'Registration verification failed');
    }
  } catch (error) {
    logger.error('Error in passkey registration verification:', error);
    next(error);
  } finally {
    currentChallenge = undefined;
  }
});

// WebAuthn authentication endpoint
router.post('/webauthn/authenticate', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('Starting WebAuthn authentication process', {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            path: req.path,
            fullUrl: req.protocol + '://' + req.get('host') + req.originalUrl
        });

        const credentials = await prisma.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });

        logger.info('Found credentials for authentication', {
            count: credentials.length,
            credentialIds: credentials.map(c => c.credentialId.substring(0, 10) + '...')
        });

        if (credentials.length === 0) {
            logger.error('No passkeys registered for authentication');
            throw new AppError(400, 'No passkey registered');
        }

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: credentials.map(cred => {
                let transports;
                try {
                    transports = cred.transports ? JSON.parse(cred.transports as string) : undefined;
                } catch (error) {
                    logger.warn(`Failed to parse transports for credential ${cred.id}`);
                    transports = undefined;
                }

                return {
                    id: base64url.toBuffer(cred.credentialId),
                    type: 'public-key',
                    transports,
                };
            }),
            userVerification: 'preferred',
        });

        // Store challenge for verification
        currentChallenge = options.challenge;

        logger.info('Generated authentication options', {
            rpID,
            origin,
            challenge: currentChallenge?.substring(0, 10) + '...',
            hasChallenge: !!currentChallenge
        });

        res.json(options);
    } catch (error) {
        logger.error('Error in WebAuthn authentication', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        next(error);
    }
});

// WebAuthn authentication verification endpoint
router.post('/webauthn/authenticate/verify', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('Starting WebAuthn authentication verification', {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            path: req.path,
            fullUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
            hasBody: !!req.body,
            credentialIdPresent: !!req.body?.id
        });

        if (!currentChallenge) {
            logger.error('No challenge found for verification');
            throw new AppError(400, 'Authentication challenge not found');
        }

        logger.info('Challenge found for verification', {
            challenge: currentChallenge.substring(0, 10) + '...'
        });

        if (!req.body || !req.body.id) {
            logger.error('Invalid authentication response', { body: JSON.stringify(req.body) });
            throw new AppError(400, 'Invalid authentication response. Missing credential ID.');
        }

        // Find the credential in the database
        const credentialId = req.body.id;
        logger.info('Looking up credential', { 
            credentialId: typeof credentialId === 'string' ? credentialId.substring(0, 10) + '...' : 'not a string',
            credentialType: typeof credentialId
        });

        const credentials = await prisma.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });

        logger.info('Found credentials in database', {
            count: credentials.length,
            credentialIds: credentials.map(c => c.credentialId.substring(0, 10) + '...')
        });

        // Find the matching credential
        const credential = credentials.find(
            cred => cred.credentialId === credentialId
        );

        if (!credential) {
            logger.error('Credential not found', { 
                credentialId: typeof credentialId === 'string' ? credentialId.substring(0, 10) + '...' : 'not a string',
                availableCredentials: credentials.map(c => ({
                    id: c.credentialId.substring(0, 10) + '...',
                    createdAt: c.createdAt
                }))
            });
            throw new AppError(400, 'Authentication failed: Credential not found');
        }

        logger.info('Found matching credential', { 
            credentialId: credential.credentialId.substring(0, 10) + '...',
            createdAt: credential.createdAt
        });

        try {
            // Verify the authentication
            logger.info('Verifying authentication response', {
                challenge: currentChallenge.substring(0, 10) + '...',
                origin,
                rpID
            });

            const verification = await verifyAuthenticationResponse({
                response: req.body,
                expectedChallenge: currentChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                authenticator: {
                    credentialID: base64url.toBuffer(credential.credentialId),
                    credentialPublicKey: base64url.toBuffer(credential.publicKey),
                    counter: bigIntToNumber(credential.counter),
                },
            });

            logger.info('Authentication verification result', { 
                verified: verification.verified,
                newCounter: verification.authenticationInfo?.newCounter
            });

            if (verification.verified) {
                // Update the counter in the database
                await prisma.webAuthnCredential.update({
                    where: { id: credential.id },
                    data: { 
                        counter: BigInt(verification.authenticationInfo.newCounter),
                        lastUsed: new Date()
                    },
                });

                // Clear the challenge after successful verification
                currentChallenge = undefined;

                // Generate a JWT token
                const token = jwt.sign(
                    { userId: 'admin', role: 'admin' },
                    process.env.ADMIN_AUTH_SECRET!,
                    { expiresIn: '7d' }
                );

                logger.info('Authentication successful, token generated');
                
                // Return the token
                return res.json({ 
                    status: 'success',
                    data: {
                        token
                    }
                });
            } else {
                logger.error('Authentication verification failed');
                throw new AppError(400, 'Authentication verification failed');
            }
        } catch (error: any) {
            logger.error('Error during authentication verification', {
                error: error.message,
                stack: error.stack
            });
            
            // Clear the challenge on error
            currentChallenge = undefined;
            
            throw new AppError(400, `Authentication failed: ${error.message}`);
        }
    } catch (error) {
        // Clear the challenge on any error
        currentChallenge = undefined;
        // Track failed login attempt
        await trackLoginAttempts(req, res, () => next(error));
    }
});

// First-time setup registration endpoint (no auth required)
router.post('/webauthn/first-time-setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Starting first-time setup passkey registration process', {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Only allow registration if no credentials exist yet
    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    if (existingCredentials.length > 0) {
      throw new AppError(400, 'Setup already completed. Use regular registration endpoint.');
    }

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: 'admin',
      userName: 'Administrator',
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store challenge for verification
    currentChallenge = options.challenge;

    res.json(options);
  } catch (error) {
    next(error);
  }
});

// First-time setup verification endpoint (no auth required)
router.post('/webauthn/first-time-setup/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Verifying first-time setup passkey registration', {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Only allow verification if no credentials exist yet
    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    if (existingCredentials.length > 0) {
      throw new AppError(400, 'Setup already completed. Use regular registration endpoint.');
    }

    if (!currentChallenge) {
      throw new AppError(400, 'Registration session expired');
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified) {
      throw new AppError(400, 'Passkey verification failed');
    }

    // Store the credential in the database
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo!;

    // Ensure transports is stored as a valid JSON string
    let transportsJson = null;
    if (req.body.response.transports) {
      // If it's already an array, stringify it
      if (Array.isArray(req.body.response.transports)) {
        transportsJson = JSON.stringify(req.body.response.transports);
      } 
      // If it's a string but not JSON, convert it to an array and stringify
      else if (typeof req.body.response.transports === 'string') {
        try {
          // Try parsing it first in case it's already JSON
          JSON.parse(req.body.response.transports);
          transportsJson = req.body.response.transports;
        } catch (e) {
          // If parsing fails, treat it as a single transport
          transportsJson = JSON.stringify([req.body.response.transports]);
        }
      }
    }

    const credential = await prisma.webAuthnCredential.create({
      data: {
        userId: 'admin',
        credentialId: uint8ArrayToBase64url(credentialID),
        publicKey: uint8ArrayToBase64url(credentialPublicKey),
        counter: counter,
        transports: transportsJson,
        createdAt: new Date(),
        lastUsed: new Date(),
      },
    });

    // Clear the challenge
    currentChallenge = undefined;

    // Generate a token for the admin user
    const token = jwt.sign(
      { userId: 'admin', type: 'admin' },
      process.env.ADMIN_AUTH_SECRET!,
      { expiresIn: '7d' }
    );

    logger.info('First-time setup passkey registered successfully');

    res.json({
      status: 'success',
      data: {
        verified: true,
        message: 'First-time setup completed successfully',
        credential: {
          id: credential.id,
          createdAt: credential.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Check if system needs first-time setup
router.get('/setup-required', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    res.json({
      status: 'success',
      data: {
        setupRequired: credentials.length === 0,
        hasPasskeys: credentials.length > 0,
        hasPassword: false // Always false now that we're passkey-only
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get registered passkeys
router.get('/webauthn/credentials', authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' },
      select: {
        id: true,
        credentialId: true,
        createdAt: true,
        lastUsed: true
      }
    });

    res.json({
      status: 'success',
      data: {
        credentials
      }
    });
  } catch (error) {
    next(error);
  }
});

// Remove a passkey
router.delete('/webauthn/credentials/:credentialId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credentialId } = req.params;

    // Check if this is the last passkey
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    if (credentials.length === 1) {
      throw new AppError(400, 'Cannot remove the last passkey');
    }

    await prisma.webAuthnCredential.deleteMany({
      where: {
        userId: 'admin',
        credentialId
      }
    });

    res.json({
      status: 'success',
      message: 'Passkey removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router; 
