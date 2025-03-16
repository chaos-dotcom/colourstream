"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockedIPService = void 0;
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
// Function to hash IP addresses
const hashIP = (ip) => {
    return (0, crypto_1.createHash)('sha256').update(ip).digest('hex');
};
exports.blockedIPService = {
    // Check if an IP is blocked
    async isBlocked(ip) {
        try {
            const hashedIP = hashIP(ip);
            const blockedIP = await prisma_1.default.blockedIP.findFirst({
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
        }
        catch (error) {
            logger_1.logger.error('Error checking if IP is blocked:', error);
            // Default to not blocked in case of error
            return false;
        }
    },
    // Block an IP
    async blockIP(ip, reason, duration) {
        try {
            const hashedIP = hashIP(ip);
            const unblockAt = duration ? new Date(Date.now() + duration) : null;
            await prisma_1.default.blockedIP.upsert({
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
            logger_1.logger.info(`Blocked IP ${ip} for reason: ${reason}`);
        }
        catch (error) {
            logger_1.logger.error('Error blocking IP:', error);
            throw error;
        }
    },
    // Unblock an IP
    async unblockIP(ip) {
        try {
            const hashedIP = hashIP(ip);
            await prisma_1.default.blockedIP.updateMany({
                where: { hashedIP },
                data: { isActive: false }
            });
            logger_1.logger.info(`Unblocked IP ${ip}`);
        }
        catch (error) {
            logger_1.logger.error('Error unblocking IP:', error);
            throw error;
        }
    },
    // Get blocked IP details
    async getBlockedIPDetails(ip) {
        try {
            const hashedIP = hashIP(ip);
            return prisma_1.default.blockedIP.findUnique({
                where: { hashedIP }
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting blocked IP details:', error);
            throw error;
        }
    },
    // Increment failed attempts
    async incrementFailedAttempts(ip, reason) {
        try {
            const hashedIP = hashIP(ip);
            const result = await prisma_1.default.blockedIP.upsert({
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
        }
        catch (error) {
            logger_1.logger.error('Error incrementing failed attempts:', error);
            throw error;
        }
    },
    // Clean up old records
    async cleanupOldRecords() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            await prisma_1.default.blockedIP.deleteMany({
                where: {
                    isActive: false,
                    blockedAt: { lt: thirtyDaysAgo }
                }
            });
            logger_1.logger.info('Cleaned up old blocked IP records');
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up old records:', error);
            throw error;
        }
    }
};
