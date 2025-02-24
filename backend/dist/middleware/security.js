"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackLoginAttempts = exports.ipBlocker = exports.loginLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const blockedIP_1 = require("../services/blockedIP");
const logger_1 = require("../utils/logger");
// Rate limiter for general requests
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// Stricter rate limiter for login attempts
exports.loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// Middleware to check if IP is blocked
const ipBlocker = async (req, res, next) => {
    try {
        // Skip IP blocking for authentication and OBS routes
        if (req.path.endsWith('/auth/login') ||
            req.path.startsWith('/api/obs/') ||
            req.path.startsWith('/api/rooms/validate')) {
            return next();
        }
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const isBlocked = await blockedIP_1.blockedIPService.isBlocked(clientIP);
        if (isBlocked) {
            logger_1.logger.warn(`Blocked request from IP: ${clientIP}`);
            return res.status(403).json({ error: 'Access denied - IP is blocked' });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in IP blocker middleware:', error);
        next(error);
    }
};
exports.ipBlocker = ipBlocker;
// Middleware to track failed login attempts and block IPs if necessary
const trackLoginAttempts = async (req, res, next) => {
    try {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        // Check if already blocked
        if (await blockedIP_1.blockedIPService.isBlocked(clientIP)) {
            return res.status(403).json({ error: 'IP is blocked due to too many failed attempts' });
        }
        // Increment failed attempts
        const attempts = await blockedIP_1.blockedIPService.incrementFailedAttempts(clientIP, 'Failed login attempt');
        // Block after 20 failed attempts (increased from 10)
        if (attempts >= 20) {
            // Block for 1 hour instead of 24 hours
            await blockedIP_1.blockedIPService.blockIP(clientIP, 'Too many failed login attempts', 60 * 60 * 1000);
            logger_1.logger.warn(`IP ${clientIP} blocked due to too many failed login attempts`);
            return res.status(403).json({ error: 'IP has been blocked due to too many failed login attempts. Try again in 1 hour.' });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in login attempts tracking middleware:', error);
        next(error);
    }
};
exports.trackLoginAttempts = trackLoginAttempts;
// Clean up old blocked IP records periodically (run once a day)
setInterval(() => {
    blockedIP_1.blockedIPService.cleanupOldRecords()
        .catch(error => logger_1.logger.error('Error cleaning up old blocked IP records:', error));
}, 24 * 60 * 60 * 1000);
