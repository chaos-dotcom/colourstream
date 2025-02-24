import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { omenService } from '../services/omenService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get all virtual hosts
router.get('/vhosts', authenticateToken, async (_req, res, next) => {
    try {
        const vhosts = await omenService.getVirtualHosts();
        res.json({
            status: 'success',
            data: { vhosts }
        });
    } catch (error) {
        logger.error('Error fetching virtual hosts:', error);
        next(error);
    }
});

// Get applications for a virtual host
router.get('/vhosts/:vhost/apps', authenticateToken, async (req, res, next) => {
    try {
        const applications = await omenService.getApplications(req.params.vhost);
        res.json({
            status: 'success',
            data: { applications }
        });
    } catch (error) {
        logger.error(`Error fetching applications for vhost ${req.params.vhost}:`, error);
        next(error);
    }
});

// Get virtual host statistics
router.get('/vhosts/:vhost/stats', authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService.getVirtualHostStats(req.params.vhost);
        res.json({
            status: 'success',
            data: { stats }
        });
    } catch (error) {
        logger.error(`Error fetching stats for vhost ${req.params.vhost}:`, error);
        next(error);
    }
});

// Get application statistics
router.get('/vhosts/:vhost/apps/:app/stats', authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService.getApplicationStats(req.params.vhost, req.params.app);
        res.json({
            status: 'success',
            data: { stats }
        });
    } catch (error) {
        logger.error(`Error fetching stats for app ${req.params.app}:`, error);
        next(error);
    }
});

// Get stream statistics
router.get('/vhosts/:vhost/apps/:app/streams/:stream/stats', authenticateToken, async (req, res, next) => {
    try {
        const stats = await omenService.getStreamStats(
            req.params.vhost,
            req.params.app,
            req.params.stream
        );
        res.json({
            status: 'success',
            data: { stats }
        });
    } catch (error) {
        logger.error(`Error fetching stats for stream ${req.params.stream}:`, error);
        next(error);
    }
});

export default router; 