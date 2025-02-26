"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePassword = void 0;
const logger_1 = require("./logger");
const initializePassword = async () => {
    try {
        logger_1.logger.info('Initializing authentication system');
        // Check for required WebAuthn configuration
        if (!process.env.WEBAUTHN_RP_ID || !process.env.JWT_KEY) {
            throw new Error('Required WebAuthn configuration missing');
        }
        logger_1.logger.info('Authentication system initialized successfully', {
            envVars: {
                NODE_ENV: process.env.NODE_ENV,
                hasJwtSecret: !!process.env.JWT_KEY,
                hasWebAuthnConfig: !!process.env.WEBAUTHN_RP_ID
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize authentication system:', {
            error: error.message,
            stack: error.stack,
            type: error.constructor.name
        });
        throw error;
    }
};
exports.initializePassword = initializePassword;
