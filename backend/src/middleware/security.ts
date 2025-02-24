import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { blockedIPService } from '../services/blockedIP';
import { logger } from '../utils/logger';

// Rate limiter for general requests
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for login attempts
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware to check if IP is blocked
export const ipBlocker = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Skip IP blocking for authentication and OBS routes
        if (req.path.endsWith('/auth/login') || 
            req.path.startsWith('/api/obs/') ||
            req.path.startsWith('/api/rooms/validate')) {
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

// Middleware to track failed login attempts and block IPs if necessary
export const trackLoginAttempts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        
        // Check if already blocked
        if (await blockedIPService.isBlocked(clientIP)) {
            return res.status(403).json({ error: 'IP is blocked due to too many failed attempts' });
        }

        // Increment failed attempts
        const attempts = await blockedIPService.incrementFailedAttempts(clientIP, 'Failed login attempt');
        
        // Block after 20 failed attempts (increased from 10)
        if (attempts >= 20) {
            // Block for 1 hour instead of 24 hours
            await blockedIPService.blockIP(clientIP, 'Too many failed login attempts', 60 * 60 * 1000);
            logger.warn(`IP ${clientIP} blocked due to too many failed login attempts`);
            return res.status(403).json({ error: 'IP has been blocked due to too many failed login attempts. Try again in 1 hour.' });
        }

        next();
    } catch (error) {
        logger.error('Error in login attempts tracking middleware:', error);
        next(error);
    }
};

// Clean up old blocked IP records periodically (run once a day)
setInterval(() => {
    blockedIPService.cleanupOldRecords()
        .catch(error => logger.error('Error cleaning up old blocked IP records:', error));
}, 24 * 60 * 60 * 1000); 