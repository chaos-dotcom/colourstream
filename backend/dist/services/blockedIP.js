"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockedIPService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma = new client_1.PrismaClient();
// Function to hash IP addresses
const hashIP = (ip) => {
    return (0, crypto_1.createHash)('sha256').update(ip).digest('hex');
};
exports.blockedIPService = {
    // Check if an IP is blocked
    async isBlocked(ip) {
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
    async blockIP(ip, reason, duration) {
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
    async unblockIP(ip) {
        const hashedIP = hashIP(ip);
        await prisma.blockedIP.updateMany({
            where: { hashedIP },
            data: { isActive: false }
        });
    },
    // Get blocked IP details
    async getBlockedIPDetails(ip) {
        const hashedIP = hashIP(ip);
        return prisma.blockedIP.findUnique({
            where: { hashedIP }
        });
    },
    // Increment failed attempts
    async incrementFailedAttempts(ip, reason) {
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
    async cleanupOldRecords() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await prisma.blockedIP.deleteMany({
            where: {
                isActive: false,
                blockedAt: { lt: thirtyDaysAgo }
            }
        });
    }
};
