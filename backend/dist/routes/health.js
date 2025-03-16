"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
/**
 * @route GET /api/health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', (_req, res) => {
    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'backend',
        version: process.env.npm_package_version || 'unknown'
    });
});
/**
 * @route GET /api/health/db
 * @desc Database health check endpoint
 * @access Public
 */
router.get('/db', async (_req, res) => {
    try {
        // Simple query to check database connection
        await prisma_1.default.$queryRaw `SELECT 1 as connected`;
        return res.status(200).json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Database health check failed:', error);
        return res.status(503).json({
            status: 'error',
            database: 'disconnected',
            timestamp: new Date().toISOString(),
            message: 'Database connection failed'
        });
    }
});
/**
 * @route GET /api/health/detailed
 * @desc Detailed health check with database and system info
 * @access Public
 */
router.get('/detailed', async (_req, res) => {
    var _a;
    try {
        // Check database connection
        const dbConnected = await prisma_1.default.$queryRaw `SELECT 1 as connected`
            .then(() => true)
            .catch(() => false);
        // Get system info
        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
        // Get database info if connected
        let dbInfo = null;
        if (dbConnected) {
            try {
                const dbVersion = await prisma_1.default.$queryRaw `SELECT version() as version`;
                dbInfo = {
                    version: ((_a = dbVersion[0]) === null || _a === void 0 ? void 0 : _a.version) || 'unknown',
                    connected: true
                };
            }
            catch (error) {
                dbInfo = {
                    connected: true,
                    version: 'unknown'
                };
            }
        }
        return res.status(dbConnected ? 200 : 503).json({
            status: dbConnected ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            database: {
                connected: dbConnected,
                info: dbInfo
            },
            system: systemInfo
        });
    }
    catch (error) {
        logger_1.logger.error('Detailed health check failed:', error);
        return res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            message: 'Health check failed'
        });
    }
});
exports.default = router;
