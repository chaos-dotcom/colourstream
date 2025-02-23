import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Function to hash IP addresses
const hashIP = (ip: string): string => {
    return createHash('sha256').update(ip).digest('hex');
};

export const blockedIPService = {
    // Check if an IP is blocked
    async isBlocked(ip: string): Promise<boolean> {
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
    },

    // Block an IP
    async blockIP(ip: string, reason: string, duration?: number): Promise<void> {
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
    },

    // Unblock an IP
    async unblockIP(ip: string): Promise<void> {
        const hashedIP = hashIP(ip);
        await prisma.blockedIP.updateMany({
            where: { hashedIP },
            data: { isActive: false }
        });
    },

    // Get blocked IP details
    async getBlockedIPDetails(ip: string) {
        const hashedIP = hashIP(ip);
        return prisma.blockedIP.findUnique({
            where: { hashedIP }
        });
    },

    // Increment failed attempts
    async incrementFailedAttempts(ip: string, reason: string): Promise<number> {
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
    },

    // Clean up old records
    async cleanupOldRecords(): Promise<void> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await prisma.blockedIP.deleteMany({
            where: {
                isActive: false,
                blockedAt: { lt: thirtyDaysAgo }
            }
        });
    }
}; 