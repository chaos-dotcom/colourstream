"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = void 0;
exports.authenticateToken = authenticateToken;
exports.isAdmin = isAdmin;
exports.isOIDCAuthenticated = isOIDCAuthenticated;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("./errorHandler");
const verifyToken = async (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.ADMIN_AUTH_SECRET);
        return decoded;
    }
    catch (error) {
        throw new errorHandler_1.AppError(401, 'Invalid or expired token');
    }
};
exports.verifyToken = verifyToken;
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        logger_1.logger.warn('Authentication failed: No token provided');
        return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.ADMIN_AUTH_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        logger_1.logger.warn('Authentication failed: Invalid token', { error });
        return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
    }
}
function isAdmin(req, res, next) {
    if (!req.user || req.user.type !== 'admin') {
        logger_1.logger.warn('Authorization failed: Admin access required', { user: req.user });
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
    next();
}
function isOIDCAuthenticated(req, res, next) {
    if (!req.oidc || !req.oidc.isAuthenticated || !req.oidc.isAuthenticated()) {
        logger_1.logger.warn('OIDC Authentication failed: User not authenticated');
        return res.status(401).json({ status: 'error', message: 'OIDC authentication required' });
    }
    next();
}
