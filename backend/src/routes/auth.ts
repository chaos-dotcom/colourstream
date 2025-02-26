import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/errorHandler';
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

const router = express.Router();

// WebAuthn configuration
const rpName = 'ColourStream Admin';
const rpID = process.env.WEBAUTHN_RP_ID || 'live.colourstream.johnrogerscolour.co.uk';
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

// WebAuthn registration endpoint
router.post('/webauthn/register', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.info('Starting passkey registration process', {
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });

        // Only allow registration if no credential exists with the same name
        const existingCredentials = await prisma.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });

        logger.info('Checking existing passkeys', {
            count: existingCredentials.length,
            lastUsed: existingCredentials[0]?.lastUsed || null
        });

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: 'admin',
            userName: 'admin',
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
router.post('/webauthn/register/verify', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Starting passkey registration verification');

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
          credentialId: credentialIdString
        }
      });

      if (existingCredential) {
        logger.warn('Credential already exists', { credentialId: credentialIdString });
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
          userId: 'admin',
          transports: transportsJson
        }
      });

      logger.info('Passkey registered successfully');

      res.json({ 
        status: 'success',
        message: 'Passkey registered successfully',
        verified: true 
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
router.post('/webauthn/authenticate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    if (credentials.length === 0) {
      throw new AppError(400, 'No passkey registered');
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: credentials.map(cred => {
        let transports;
        try {
          transports = cred.transports ? JSON.parse(cred.transports) : undefined;
        } catch (error: any) {
          logger.warn(`Failed to parse transports for credential ${cred.id}: ${error.message}`);
          // If parsing fails, try to handle common cases
          if (cred.transports === 'internal') {
            transports = ['internal'];
          } else if (cred.transports) {
            // Try to split by comma if it's a comma-separated string
            transports = cred.transports.split(',').map(t => t.trim());
          } else {
            transports = undefined;
          }
        }
        
        return {
          id: base64url.toBuffer(cred.credentialId),
          type: 'public-key' as const,
          transports,
        };
      }),
      userVerification: 'preferred',
    });

    currentChallenge = options.challenge;

    res.json(options);
  } catch (error) {
    next(error);
  }
});

// WebAuthn authentication verification endpoint
router.post('/webauthn/authenticate/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!currentChallenge) {
      throw new AppError(400, 'Authentication challenge not found');
    }

    // Find the credential that matches the authentication response
    const credential = await prisma.webAuthnCredential.findFirst({
      where: { 
        userId: 'admin',
        credentialId: base64url.encode(Buffer.from(req.body.id, 'base64url'))
      }
    });

    if (!credential) {
      throw new AppError(400, 'No matching passkey found');
    }

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

    if (verification.verified) {
      // Update counter
      await prisma.webAuthnCredential.update({
        where: { id: credential.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsed: new Date()
        }
      });

      // Generate JWT token - no need to check for password here
      const token = jwt.sign(
        { userId: 'admin' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      res.json({
        status: 'success',
        data: { token }
      });
    } else {
      throw new AppError(401, 'Authentication failed');
    }
  } catch (error) {
    next(error);
  } finally {
    currentChallenge = undefined;
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
      process.env.COLOURSTREAM_JWT_SECRET!,
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