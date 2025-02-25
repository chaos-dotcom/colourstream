import { logger } from './logger';

export const initializePassword = async () => {
    try {
        logger.info('Initializing authentication system');
        
        // Check for required WebAuthn configuration
        if (!process.env.WEBAUTHN_RP_ID || !process.env.JWT_SECRET) {
            throw new Error('Required WebAuthn configuration missing');
        }

        logger.info('Authentication system initialized successfully', {
            envVars: {
                NODE_ENV: process.env.NODE_ENV,
                hasJwtSecret: !!process.env.JWT_SECRET,
                hasWebAuthnConfig: !!process.env.WEBAUTHN_RP_ID
            }
        });
    } catch (error: any) {
        logger.error('Failed to initialize authentication system:', {
            error: error.message,
            stack: error.stack,
            type: error.constructor.name
        });
        throw error;
    }
}; 