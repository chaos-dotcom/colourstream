import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { updatePasswordHash } from '../utils/updateEnvFile';
import { loginLimiter, trackLoginAttempts } from '../middleware/security';
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

// Passkey-only mode is implicit when no password exists
const isPasskeyOnlyMode = () => !process.env.ADMIN_PASSWORD;

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
    logger.info('Starting passkey registration process');
    
    // Only allow registration if no credential exists with the same name
    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    logger.info(`Found ${existingCredentials.length} existing passkeys`);

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
      challenge: currentChallenge
    });

    res.json(options);
  } catch (error) {
    logger.error('Error in passkey registration:', error);
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

      await prisma.webAuthnCredential.create({
        data: {
          credentialId: credentialIdString,
          publicKey: publicKeyString,
          counter: counter,
          userId: 'admin',
          transports: req.body.response.transports ? JSON.stringify(req.body.response.transports) : null
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
    const credential = await prisma.webAuthnCredential.findFirst({
      where: { userId: 'admin' }
    });

    if (!credential) {
      throw new AppError(400, 'No passkey registered');
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [{
        id: base64url.toBuffer(credential.credentialId),
        type: 'public-key',
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      }],
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

    const credential = await prisma.webAuthnCredential.findFirst({
      where: { userId: 'admin' }
    });

    if (!credential) {
      throw new AppError(400, 'No passkey registered');
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

router.post('/login', loginLimiter, trackLoginAttempts,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('Login validation failed:', errors.array());
        throw new AppError(400, 'Validation error');
      }

      // Check if passkeys exist
      const existingPasskey = await prisma.webAuthnCredential.findFirst({
        where: { userId: 'admin' }
      });

      if (existingPasskey) {
        logger.warn('Password login attempted when passkeys exist');
        throw new AppError(401, 'Password authentication is disabled. Please use your registered passkey to login.');
      }
      
      // Check if we're in passkey-only mode
      if (isPasskeyOnlyMode()) {
        logger.warn('Password login attempted while in passkey-only mode');
        throw new AppError(401, 'Password authentication is disabled. Please use a passkey to login.');
      }

      const { password } = req.body;
      
      // Get admin password from env
      const adminPassword = process.env.ADMIN_PASSWORD;

      logger.info('Attempting password login', {
        hasPassword: !!adminPassword,
        passKeyOnlyMode: isPasskeyOnlyMode()
      });

      // Simple string comparison for password check
      if (password !== adminPassword) {
        logger.warn('Invalid password attempt', {
          ip: req.ip
        });
        throw new AppError(401, 'Invalid password');
      }

      const token = jwt.sign(
        { userId: 'admin' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      logger.info('Successful password login', { 
        ip: req.ip
      });
      
      res.json({
        status: 'success',
        data: {
          token,
        },
      });
    } catch (error) {
      logger.error('Login error:', {
        error,
        ip: req.ip,
        headers: req.headers
      });
      next(error);
    }
  }
);

router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const { currentPassword, newPassword } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      // If no password is set, this is a misconfiguration
      if (!adminPassword) {
        logger.error('No admin password set in environment');
        throw new AppError(401, 'No password has been set. Please contact your administrator.');
      }

      // Verify current password
      if (currentPassword !== adminPassword) {
        throw new AppError(401, 'Current password is incorrect');
      }

      // Update .env file with new password
      await updatePasswordHash(newPassword);

      // Update environment variable
      process.env.ADMIN_PASSWORD = newPassword;

      res.json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Check if password authentication is enabled
router.get('/has-password', authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      status: 'success',
      data: {
        hasPassword: !isPasskeyOnlyMode()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Remove password authentication
router.post('/remove-password', authenticateToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Attempting to remove password authentication');

    // Check if at least one passkey exists before allowing password removal
    const passkey = await prisma.webAuthnCredential.findFirst({
      where: { userId: 'admin' }
    });

    if (!passkey) {
      logger.warn('Cannot remove password: no passkey registered');
      throw new AppError(400, 'Cannot remove password authentication without a passkey');
    }

    try {
      // Remove the password from .env file
      await updatePasswordHash('');
      
      // Update the environment variable immediately
      process.env.ADMIN_PASSWORD = '';
      
      logger.info('Password authentication removed successfully');

      res.json({
        status: 'success',
        message: 'Password authentication removed'
      });
    } catch (error) {
      logger.error('Failed to remove password:', error);
      throw new AppError(500, 'Failed to remove password authentication');
    }
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

    // Check if this is the last passkey and password is disabled
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: 'admin' }
    });

    if (credentials.length === 1 && !process.env.ADMIN_PASSWORD_HASH) {
      throw new AppError(400, 'Cannot remove the last passkey when password authentication is disabled');
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