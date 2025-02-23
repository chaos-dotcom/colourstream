"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const blockedIP_1 = require("../services/blockedIP");
const errorHandler_1 = require("../middleware/errorHandler");
const express_validator_1 = require("express-validator");
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Get all blocked IPs (paginated)
router.get('/blocked-ips', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
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
    }
    catch (error) {
        next(error);
    }
});
// Block an IP manually
router.post('/block-ip', auth_1.authenticateToken, [
    (0, express_validator_1.body)('ip').notEmpty().withMessage('IP address is required'),
    (0, express_validator_1.body)('reason').notEmpty().withMessage('Reason is required'),
    (0, express_validator_1.body)('duration').optional().isInt({ min: 0 }).withMessage('Duration must be a positive number'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { ip, reason, duration } = req.body;
        await blockedIP_1.blockedIPService.blockIP(ip, reason, duration);
        res.json({
            status: 'success',
            message: 'IP blocked successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
// Unblock an IP
router.post('/unblock-ip', auth_1.authenticateToken, [
    (0, express_validator_1.body)('ip').notEmpty().withMessage('IP address is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { ip } = req.body;
        await blockedIP_1.blockedIPService.unblockIP(ip);
        res.json({
            status: 'success',
            message: 'IP unblocked successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
// Get IP details
router.get('/ip-details/:ip', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const { ip } = req.params;
        const details = await blockedIP_1.blockedIPService.getBlockedIPDetails(ip);
        if (!details) {
            throw new errorHandler_1.AppError(404, 'IP details not found');
        }
        res.json({
            status: 'success',
            data: details
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
