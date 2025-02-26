"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../lib/prisma"));
const server_1 = require("@simplewebauthn/server");
const base64url_1 = __importDefault(require("base64url"));
const router = express_1.default.Router();
// WebAuthn configuration
const rpName = 'ColourStream Admin';
const rpID = process.env.WEBAUTHN_RP_ID || 'live.colourstream.johnrogerscolour.co.uk';
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;
// Store challenge temporarily (in production, use Redis or similar)
let currentChallenge;
// Helper function to convert Uint8Array to base64url string
function uint8ArrayToBase64url(array) {
    return base64url_1.default.encode(Buffer.from(array));
}
// Helper function to convert BigInt to number safely
function bigIntToNumber(value) {
    const number = Number(value);
    if (number > Number.MAX_SAFE_INTEGER) {
        throw new Error('Counter value too large');
    }
    return number;
}
// WebAuthn registration endpoint
router.post('/webauthn/register', auth_1.authenticateToken, async (req, res, next) => {
    var _a;
    try {
        logger_1.logger.info('Starting passkey registration process', {
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        // Only allow registration if no credential exists with the same name
        const existingCredentials = await prisma_1.default.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });
        logger_1.logger.info('Checking existing passkeys', {
            count: existingCredentials.length,
            lastUsed: ((_a = existingCredentials[0]) === null || _a === void 0 ? void 0 : _a.lastUsed) || null
        });
        const options = await (0, server_1.generateRegistrationOptions)({
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
        logger_1.logger.info('Generated registration options', {
            rpID,
            origin,
            challenge: currentChallenge,
            hasChallenge: !!currentChallenge
        });
        res.json(options);
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.logger.error('Error in passkey registration:', {
                error: error.message,
                stack: error.stack,
                type: error.constructor.name
            });
        }
        else {
            logger_1.logger.error('Unknown error in passkey registration:', error);
        }
        next(error);
    }
});
// WebAuthn registration verification endpoint
router.post('/webauthn/register/verify', auth_1.authenticateToken, async (req, res, next) => {
    try {
        logger_1.logger.info('Starting passkey registration verification');
        if (!currentChallenge) {
            logger_1.logger.error('No challenge found for verification');
            throw new errorHandler_1.AppError(400, 'Registration challenge not found');
        }
        logger_1.logger.info('Verifying registration response', {
            challenge: currentChallenge,
            origin,
            rpID
        });
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: req.body,
            expectedChallenge: currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
            logger_1.logger.info('Registration verified successfully, creating credential record');
            const credentialIdString = uint8ArrayToBase64url(credentialID);
            const publicKeyString = uint8ArrayToBase64url(credentialPublicKey);
            // Check if this specific credential already exists
            const existingCredential = await prisma_1.default.webAuthnCredential.findFirst({
                where: {
                    credentialId: credentialIdString
                }
            });
            if (existingCredential) {
                logger_1.logger.warn('Credential already exists', { credentialId: credentialIdString });
                throw new errorHandler_1.AppError(400, 'This passkey is already registered');
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
                    }
                    catch (e) {
                        // If parsing fails, treat it as a single transport
                        transportsJson = JSON.stringify([req.body.response.transports]);
                    }
                }
            }
            await prisma_1.default.webAuthnCredential.create({
                data: {
                    credentialId: credentialIdString,
                    publicKey: publicKeyString,
                    counter: counter,
                    userId: 'admin',
                    transports: transportsJson
                }
            });
            logger_1.logger.info('Passkey registered successfully');
            res.json({
                status: 'success',
                message: 'Passkey registered successfully',
                verified: true
            });
        }
        else {
            logger_1.logger.error('Registration verification failed');
            throw new errorHandler_1.AppError(400, 'Registration verification failed');
        }
    }
    catch (error) {
        logger_1.logger.error('Error in passkey registration verification:', error);
        next(error);
    }
    finally {
        currentChallenge = undefined;
    }
});
// WebAuthn authentication endpoint
router.post('/webauthn/authenticate', async (req, res, next) => {
    try {
        const credentials = await prisma_1.default.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });
        if (credentials.length === 0) {
            throw new errorHandler_1.AppError(400, 'No passkey registered');
        }
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID,
            allowCredentials: credentials.map(cred => {
                let transports;
                try {
                    transports = cred.transports ? JSON.parse(cred.transports) : undefined;
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to parse transports for credential ${cred.id}: ${error.message}`);
                    // If parsing fails, try to handle common cases
                    if (cred.transports === 'internal') {
                        transports = ['internal'];
                    }
                    else if (cred.transports) {
                        // Try to split by comma if it's a comma-separated string
                        transports = cred.transports.split(',').map(t => t.trim());
                    }
                    else {
                        transports = undefined;
                    }
                }
                return {
                    id: base64url_1.default.toBuffer(cred.credentialId),
                    type: 'public-key',
                    transports,
                };
            }),
            userVerification: 'preferred',
        });
        currentChallenge = options.challenge;
        res.json(options);
    }
    catch (error) {
        next(error);
    }
});
// WebAuthn authentication verification endpoint
router.post('/webauthn/authenticate/verify', async (req, res, next) => {
    try {
        if (!currentChallenge) {
            throw new errorHandler_1.AppError(400, 'Authentication challenge not found');
        }
        // Find the credential that matches the authentication response
        const credential = await prisma_1.default.webAuthnCredential.findFirst({
            where: {
                userId: 'admin',
                credentialId: base64url_1.default.encode(Buffer.from(req.body.id, 'base64url'))
            }
        });
        if (!credential) {
            throw new errorHandler_1.AppError(400, 'No matching passkey found');
        }
        const verification = await (0, server_1.verifyAuthenticationResponse)({
            response: req.body,
            expectedChallenge: currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: {
                credentialID: base64url_1.default.toBuffer(credential.credentialId),
                credentialPublicKey: base64url_1.default.toBuffer(credential.publicKey),
                counter: bigIntToNumber(credential.counter),
            },
        });
        if (verification.verified) {
            // Update counter
            await prisma_1.default.webAuthnCredential.update({
                where: { id: credential.id },
                data: {
                    counter: BigInt(verification.authenticationInfo.newCounter),
                    lastUsed: new Date()
                }
            });
            // Generate JWT token - no need to check for password here
            const token = jsonwebtoken_1.default.sign({ userId: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.json({
                status: 'success',
                data: { token }
            });
        }
        else {
            throw new errorHandler_1.AppError(401, 'Authentication failed');
        }
    }
    catch (error) {
        next(error);
    }
    finally {
        currentChallenge = undefined;
    }
});
// First-time setup registration endpoint (no auth required)
router.post('/webauthn/first-time-setup', async (req, res, next) => {
    try {
        logger_1.logger.info('Starting first-time setup passkey registration process', {
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        // Only allow registration if no credentials exist yet
        const existingCredentials = await prisma_1.default.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });
        if (existingCredentials.length > 0) {
            throw new errorHandler_1.AppError(400, 'Setup already completed. Use regular registration endpoint.');
        }
        // Generate registration options
        const options = await (0, server_1.generateRegistrationOptions)({
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
    }
    catch (error) {
        next(error);
    }
});
// First-time setup verification endpoint (no auth required)
router.post('/webauthn/first-time-setup/verify', async (req, res, next) => {
    try {
        logger_1.logger.info('Verifying first-time setup passkey registration', {
            userAgent: req.headers['user-agent'],
            ip: req.ip
        });
        // Only allow verification if no credentials exist yet
        const existingCredentials = await prisma_1.default.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });
        if (existingCredentials.length > 0) {
            throw new errorHandler_1.AppError(400, 'Setup already completed. Use regular registration endpoint.');
        }
        if (!currentChallenge) {
            throw new errorHandler_1.AppError(400, 'Registration session expired');
        }
        // Verify the registration response
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: req.body,
            expectedChallenge: currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
        if (!verification.verified) {
            throw new errorHandler_1.AppError(400, 'Passkey verification failed');
        }
        // Store the credential in the database
        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
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
                }
                catch (e) {
                    // If parsing fails, treat it as a single transport
                    transportsJson = JSON.stringify([req.body.response.transports]);
                }
            }
        }
        const credential = await prisma_1.default.webAuthnCredential.create({
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
        const token = jsonwebtoken_1.default.sign({ userId: 'admin', type: 'admin' }, process.env.COLOURSTREAM_JWT_SECRET, { expiresIn: '7d' });
        logger_1.logger.info('First-time setup passkey registered successfully');
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
    }
    catch (error) {
        next(error);
    }
});
// Check if system needs first-time setup
router.get('/setup-required', async (_req, res, next) => {
    try {
        const credentials = await prisma_1.default.webAuthnCredential.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
// Get registered passkeys
router.get('/webauthn/credentials', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        const credentials = await prisma_1.default.webAuthnCredential.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
// Remove a passkey
router.delete('/webauthn/credentials/:credentialId', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const { credentialId } = req.params;
        // Check if this is the last passkey
        const credentials = await prisma_1.default.webAuthnCredential.findMany({
            where: { userId: 'admin' }
        });
        if (credentials.length === 1) {
            throw new errorHandler_1.AppError(400, 'Cannot remove the last passkey');
        }
        await prisma_1.default.webAuthnCredential.deleteMany({
            where: {
                userId: 'admin',
                credentialId
            }
        });
        res.json({
            status: 'success',
            message: 'Passkey removed successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
