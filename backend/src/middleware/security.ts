import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { blockedIPService } from '../services/blockedIP';
import { logger } from '../utils/logger';

// Rate limiter for general requests - increased limits for production
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Increased from 100 to 300 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for certain paths that need higher throughput
    skip: (req) => {
        // Skip rate limiting for static assets, websocket connections, and validation endpoints
        return req.path.includes('/static') || 
               req.path.includes('/assets') || 
               req.path.includes('/ws') ||
               req.path.startsWith('/api/rooms/validate') ||
               req.path.startsWith('/api/obs/') ||
               req.path.startsWith('/api/upload/') || // Skip all /api/upload/ routes
               req.path.startsWith('/files') ||
               req.path.startsWith('/upload');


    }
});

// Middleware to check if IP is blocked
export const ipBlocker = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Skip IP blocking for authentication and OBS routes
        if (req.path.endsWith('/auth/login') ||
            req.path.startsWith('/api/obs/') ||
            req.path.startsWith('/api/rooms/validate')  ||
            req.path.startsWith('/api/upload/')) // Skip all /api/upload/ routes
            {
            return next();
        }

        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const isBlocked = await blockedIPService.isBlocked(clientIP);

        if (isBlocked) {
            logger.warn(`Blocked request from IP: ${clientIP}`);
            return res.status(403).json({ error: 'Access denied - IP is blocked' });
        }

        next();
    } catch (error) {
        logger.error('Error in IP blocker middleware:', error);
        next(error);
    }
};

// Clean up old blocked IP records periodically (run once a day)
setInterval(() => {
    blockedIPService.cleanupOldRecords()
        .catch(error => logger.error('Error cleaning up old blocked IP records:', error));
}, 24 * 60 * 60 * 1000); 
