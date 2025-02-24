"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const omenService_1 = require("../services/omenService");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Get all virtual hosts
router.get('/vhosts', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        const vhosts = await omenService_1.omenService.getVirtualHosts();
        res.json({
            status: 'success',
            data: { vhosts }
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching virtual hosts:', error);
        next(error);
    }
});
// Get applications for a virtual host
router.get('/vhosts/:vhost/apps', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const applications = await omenService_1.omenService.getApplications(req.params.vhost);
        res.json({
            status: 'success',
            data: { applications }
        });
    }
    catch (error) {
        logger_1.logger.error(`Error fetching applications for vhost ${req.params.vhost}:`, error);
        next(error);
    }
});
// Get virtual host statistics
router.get('/vhosts/:vhost/stats', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService_1.omenService.getVirtualHostStats(req.params.vhost);
        res.json({
            status: 'success',
            data: { stats }
        });
    }
    catch (error) {
        logger_1.logger.error(`Error fetching stats for vhost ${req.params.vhost}:`, error);
        next(error);
    }
});
// Get application statistics
router.get('/vhosts/:vhost/apps/:app/stats', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService_1.omenService.getApplicationStats(req.params.vhost, req.params.app);
        res.json({
            status: 'success',
            data: { stats }
        });
    }
    catch (error) {
        logger_1.logger.error(`Error fetching stats for app ${req.params.app}:`, error);
        next(error);
    }
});
// Get stream statistics
router.get('/vhosts/:vhost/apps/:app/streams/:stream/stats', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService_1.omenService.getStreamStats(req.params.vhost, req.params.app, req.params.stream);
        res.json({
            status: 'success',
            data: { stats }
        });
    }
    catch (error) {
        logger_1.logger.error(`Error fetching stats for stream ${req.params.stream}:`, error);
        next(error);
    }
});
exports.default = router;
