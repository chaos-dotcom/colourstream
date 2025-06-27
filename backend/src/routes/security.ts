import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { blockedIPService } from '../services/blockedIP';
import { AppError } from '../middleware/errorHandler';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all blocked IPs (paginated)
router.get('/blocked-ips', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const [blockedIPs, total] = await Promise.all([
            prisma.blockedIP.findMany({
                skip,
                take: limit,
                orderBy: { blockedAt: 'desc' },
                where: {
                    isActive: true
                }
            }),
            prisma.blockedIP.count({
                where: {
                    isActive: true
                }
            })
        ]);

        // Decrypt/unhash IPs for display
        const blockedIPsWithOriginal = blockedIPs.map(ip => ({
            ...ip,
            ip: ip.originalIP || ip.hashedIP // Add originalIP field to schema
        }));

        res.json({
            status: 'success',
            data: {
                blockedIPs: blockedIPsWithOriginal,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        next(error);
    }
});

// Block an IP manually
router.post('/block-ip', 
    authenticateToken,
    [
        body('ip').notEmpty().withMessage('IP address is required'),
        body('reason').notEmpty().withMessage('Reason is required'),
        body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive number'),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError(400, 'Validation error');
            }

            const { ip, reason, duration } = req.body;

            // Convert duration from hours to milliseconds if provided
            const durationInMs = duration ? Number(duration) * 60 * 60 * 1000 : undefined;
            await blockedIPService.blockIP(ip, reason, durationInMs);

            res.json({
                status: 'success',
                message: 'IP blocked successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Unblock an IP
router.post('/unblock-ip',
    authenticateToken,
    [
        body('ip').notEmpty().withMessage('IP address is required'),
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                throw new AppError(400, 'Validation error');
            }

            const { ip } = req.body;
            await blockedIPService.unblockIP(ip);

            res.json({
                status: 'success',
                message: 'IP unblocked successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get IP details
router.get('/ip-details/:ip', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ip } = req.params;
        const details = await blockedIPService.getBlockedIPDetails(ip);

        if (!details) {
            throw new AppError(404, 'IP details not found');
        }

        res.json({
            status: 'success',
            data: details
        });
    } catch (error) {
        next(error);
    }
});

export default router; 
