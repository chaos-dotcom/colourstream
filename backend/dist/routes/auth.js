"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const updateEnvFile_1 = require("../utils/updateEnvFile");
const security_1 = require("../middleware/security");
const logger_1 = require("../utils/logger");
const prisma_1 = __importDefault(require("../lib/prisma"));
const server_1 = require("@simplewebauthn/server");
const base64url_1 = __importDefault(require("base64url"));
const router = express_1.default.Router();
// WebAuthn configuration
const rpName = 'ColourStream Admin';
const rpID = process.env.WEBAUTHN_RP_ID || 'video.colourstream.johnrogerscolour.co.uk';
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
    try {
        // Only allow registration if no credential exists
        const existingCredential = await prisma_1.default.webAuthnCredential.findFirst({
            where: { userId: 'admin' }
        });
        if (existingCredential) {
            throw new errorHandler_1.AppError(400, 'Passkey already registered');
        }
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
        res.json(options);
    }
    catch (error) {
        next(error);
    }
});
// WebAuthn registration verification endpoint
router.post('/webauthn/register/verify', auth_1.authenticateToken, async (req, res, next) => {
    try {
        if (!currentChallenge) {
            throw new errorHandler_1.AppError(400, 'Registration challenge not found');
        }
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: req.body,
            expectedChallenge: currentChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
            await prisma_1.default.webAuthnCredential.create({
                data: {
                    credentialId: uint8ArrayToBase64url(credentialID),
                    publicKey: uint8ArrayToBase64url(credentialPublicKey),
                    counter: counter,
                    userId: 'admin',
                    transports: req.body.response.transports ? JSON.stringify(req.body.response.transports) : null
                }
            });
            res.json({ verified: true });
        }
        else {
            throw new errorHandler_1.AppError(400, 'Registration verification failed');
        }
    }
    catch (error) {
        next(error);
    }
    finally {
        currentChallenge = undefined;
    }
});
// WebAuthn authentication endpoint
router.post('/webauthn/authenticate', async (req, res, next) => {
    try {
        const credential = await prisma_1.default.webAuthnCredential.findFirst({
            where: { userId: 'admin' }
        });
        if (!credential) {
            throw new errorHandler_1.AppError(400, 'No passkey registered');
        }
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID,
            allowCredentials: [{
                    id: base64url_1.default.toBuffer(credential.credentialId),
                    type: 'public-key',
                    transports: credential.transports ? JSON.parse(credential.transports) : undefined,
                }],
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
        const credential = await prisma_1.default.webAuthnCredential.findFirst({
            where: { userId: 'admin' }
        });
        if (!credential) {
            throw new errorHandler_1.AppError(400, 'No passkey registered');
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
            // Generate JWT token
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
router.post('/login', security_1.loginLimiter, security_1.trackLoginAttempts, [
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            logger_1.logger.warn('Login validation failed:', errors.array());
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { password } = req.body;
        const hashedPassword = process.env.ADMIN_PASSWORD_HASH;
        if (!hashedPassword) {
            logger_1.logger.error('Admin password hash not found in environment');
            throw new errorHandler_1.AppError(500, 'Server configuration error');
        }
        const isValid = await bcryptjs_1.default.compare(password, hashedPassword);
        if (!isValid) {
            logger_1.logger.warn('Invalid password attempt', {
                ip: req.ip
            });
            throw new errorHandler_1.AppError(401, 'Invalid password');
        }
        const token = jsonwebtoken_1.default.sign({ userId: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
        logger_1.logger.info('Successful login', { ip: req.ip });
        res.json({
            status: 'success',
            data: {
                token,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Login error:', {
            error,
            ip: req.ip,
            headers: req.headers
        });
        next(error);
    }
});
router.post('/change-password', auth_1.authenticateToken, [
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { currentPassword, newPassword } = req.body;
        const storedHash = process.env.ADMIN_PASSWORD_HASH;
        if (!storedHash) {
            throw new errorHandler_1.AppError(500, 'Admin password hash not configured');
        }
        // Verify current password
        const isValid = await bcryptjs_1.default.compare(currentPassword, storedHash);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Current password is incorrect');
        }
        // Generate new hash
        const newHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Update .env file
        await (0, updateEnvFile_1.updatePasswordHash)(newHash);
        // Update environment variable
        process.env.ADMIN_PASSWORD_HASH = newHash;
        res.json({
            status: 'success',
            message: 'Password changed successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
