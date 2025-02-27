import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

// Function to hash IP addresses
const hashIP = (ip: string): string => {
    return createHash('sha256').update(ip).digest('hex');
};

export const blockedIPService = {
    // Check if an IP is blocked
    async isBlocked(ip: string): Promise<boolean> {
        try {
            const hashedIP = hashIP(ip);
            const blockedIP = await prisma.blockedIP.findFirst({
                where: {
                    hashedIP,
                    isActive: true,
                    OR: [
                        { unblockAt: null },
                        { unblockAt: { gt: new Date() } }
                    ]
                }
            });
            return !!blockedIP;
        } catch (error) {
            logger.error('Error checking if IP is blocked:', error);
            // Default to not blocked in case of error
            return false;
        }
    },

    // Block an IP
    async blockIP(ip: string, reason: string, duration?: number): Promise<void> {
        try {
            const hashedIP = hashIP(ip);
            const unblockAt = duration ? new Date(Date.now() + duration) : null;

            await prisma.blockedIP.upsert({
                where: { hashedIP },
                update: {
                    isActive: true,
                    reason,
                    unblockAt,
                    blockedAt: new Date(),
                    failedAttempts: { increment: 1 },
                    originalIP: ip
                },
                create: {
                    hashedIP,
                    originalIP: ip,
                    reason,
                    unblockAt,
                    failedAttempts: 1,
                    isActive: true
                }
            });
            logger.info(`Blocked IP ${ip} for reason: ${reason}`);
        } catch (error) {
            logger.error('Error blocking IP:', error);
            throw error;
        }
    },

    // Unblock an IP
    async unblockIP(ip: string): Promise<void> {
        try {
            const hashedIP = hashIP(ip);
            await prisma.blockedIP.updateMany({
                where: { hashedIP },
                data: { isActive: false }
            });
            logger.info(`Unblocked IP ${ip}`);
        } catch (error) {
            logger.error('Error unblocking IP:', error);
            throw error;
        }
    },

    // Get blocked IP details
    async getBlockedIPDetails(ip: string) {
        try {
            const hashedIP = hashIP(ip);
            return prisma.blockedIP.findUnique({
                where: { hashedIP }
            });
        } catch (error) {
            logger.error('Error getting blocked IP details:', error);
            throw error;
        }
    },

    // Increment failed attempts
    async incrementFailedAttempts(ip: string, reason: string): Promise<number> {
        try {
            const hashedIP = hashIP(ip);
            const result = await prisma.blockedIP.upsert({
                where: { hashedIP },
                update: {
                    failedAttempts: { increment: 1 },
                    reason,
                    originalIP: ip
                },
                create: {
                    hashedIP,
                    originalIP: ip,
                    reason,
                    failedAttempts: 1,
                    isActive: false
                }
            });
            return result.failedAttempts;
        } catch (error) {
            logger.error('Error incrementing failed attempts:', error);
            throw error;
        }
    },

    // Clean up old records
    async cleanupOldRecords(): Promise<void> {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            await prisma.blockedIP.deleteMany({
                where: {
                    isActive: false,
                    blockedAt: { lt: thirtyDaysAgo }
                }
            });
            logger.info('Cleaned up old blocked IP records');
        } catch (error) {
            logger.error('Error cleaning up old records:', error);
            throw error;
        }
    }
}; 