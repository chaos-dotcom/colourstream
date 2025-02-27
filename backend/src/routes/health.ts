import express from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = express.Router();

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
    await prisma.$queryRaw`SELECT 1 as connected`;
    
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    
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
  try {
    // Check database connection
    const dbConnected = await prisma.$queryRaw`SELECT 1 as connected`
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
        // Define the expected type for the query result
        interface DbVersionResult {
          version: string;
        }
        
        const dbVersion = await prisma.$queryRaw<DbVersionResult[]>`SELECT version() as version`;
        dbInfo = {
          version: dbVersion[0]?.version || 'unknown',
          connected: true
        };
      } catch (error) {
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
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed'
    });
  }
});

export default router; 