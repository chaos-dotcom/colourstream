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
        const tempPassword = process.env.ADMIN_PASSWORD;
        if (!tempPassword) {
            throw new Error('ADMIN_PASSWORD not set in environment variables');
        }
        // Hash the temporary password
        const hashedPassword = await bcryptjs_1.default.hash(tempPassword, 12);
        // Store the hash in environment
        process.env.ADMIN_PASSWORD_HASH = hashedPassword;
        logger_1.logger.info('Temporary admin password has been hashed and stored');
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize admin password:', error);
        throw error;
    }
};
exports.initializePassword = initializePassword;
