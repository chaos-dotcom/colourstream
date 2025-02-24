import bcrypt from 'bcryptjs';
import { logger } from './logger';

export const initializePassword = async () => {
    try {
        const tempPassword = process.env.ADMIN_PASSWORD;
        if (!tempPassword) {
            throw new Error('ADMIN_PASSWORD not set in environment variables');
        }

        // Hash the temporary password
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        
        // Store the hash in environment
        process.env.ADMIN_PASSWORD_HASH = hashedPassword;
        
        logger.info('Temporary admin password has been hashed and stored');
    } catch (error: any) {
        logger.error('Failed to initialize admin password:', error);
        throw error;
    }
}; 