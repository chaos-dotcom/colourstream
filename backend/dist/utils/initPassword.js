"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializePassword = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const logger_1 = require("./logger");
const initializePassword = async () => {
    try {
        logger_1.logger.info('Starting password initialization process');
        const tempPassword = process.env.ADMIN_PASSWORD;
        logger_1.logger.info('Admin password status:', {
            isSet: !!tempPassword,
            length: (tempPassword === null || tempPassword === void 0 ? void 0 : tempPassword.length) || 0,
            envVars: {
                NODE_ENV: process.env.NODE_ENV,
                hasJwtSecret: !!process.env.JWT_SECRET,
                hasWebAuthnConfig: !!process.env.WEBAUTHN_RP_ID
            }
        });
        if (!tempPassword) {
            logger_1.logger.error('ADMIN_PASSWORD not set in environment variables');
            throw new Error('ADMIN_PASSWORD not set in environment variables');
        }
        logger_1.logger.info('Hashing temporary admin password');
        // Hash the temporary password
        const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 12);
        // Store the hash in environment
        process.env.ADMIN_PASSWORD_HASH = hashedPassword;
        logger_1.logger.info('Password initialization completed successfully', {
            hashedLength: hashedPassword.length,
            hashStored: !!process.env.ADMIN_PASSWORD_HASH
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize admin password:', {
            error: error.message,
            stack: error.stack,
            type: error.constructor.name
        });
        throw error;
    }
};
exports.initializePassword = initializePassword;
