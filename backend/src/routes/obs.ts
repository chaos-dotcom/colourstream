import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { obsService } from '../services';
import { logger } from '../utils/logger';

const router = express.Router();

// Require authentication for all OBS routes
router.use(authenticateToken);

// Get OBS settings
router.get(
  '/settings',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await obsService.getSettings();
      res.json({
        status: 'success',
        data: { settings },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update OBS settings
router.put(
  '/settings',
  [
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    body('streamType').equals('rtmp_custom').withMessage('Stream type must be rtmp_custom'),
    body('protocol').isIn(['rtmp', 'srt']).withMessage('Protocol must be rtmp or srt'),
    // Make host validation conditional - only required if enabled is true
    body('host').if(body('enabled').equals('true')).notEmpty().withMessage('Host is required when OBS integration is enabled'),
    // Port validation - only required if enabled is true
    body('port').if(body('enabled').equals('true')).isInt({ min: 1 }).withMessage('Port must be a positive integer when OBS integration is enabled')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error: ' + errors.array().map(err => err.msg).join(', '));
      }

      try {
        const settings = await obsService.updateSettings(req.body);
        
        // Return success response
        res.json({
          status: 'success',
          data: { settings },
          // Include a warning if connection test was skipped or failed
          warning: req.body.enabled ? 
            'Settings saved, but OBS connection could not be verified. Make sure OBS is running with WebSocket server enabled.' : 
            undefined
        });
      } catch (error: any) {
        // Pass through any OBS connection errors with their original message
        throw new AppError(500, error.message || 'Failed to connect to OBS');
      }
    } catch (error) {
      next(error);
    }
  }
);

// Set stream key in OBS
router.post(
  '/set-stream-key',
  [
    body('streamKey').notEmpty().withMessage('Stream key is required'),
    body('protocol').isIn(['rtmp', 'srt']).withMessage('Protocol must be either rtmp or srt'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error: ' + errors.array().map(err => err.msg).join(', '));
      }

      const settings = await obsService.getSettings();
      if (!settings?.enabled) {
        throw new AppError(400, 'OBS integration is not enabled');
      }

      logger.info('Setting stream key with settings:', {
        protocol: req.body.protocol,
        host: settings.host,
        port: settings.port
      });

      // Update the settings with the current protocol
      await obsService.updateSettings({
        ...settings,
        protocol: req.body.protocol
      });

      try {
        await obsService.connectToOBS(settings);
        await obsService.setStreamKey(req.body.streamKey);
        await obsService.disconnectFromOBS();

        res.json({
          status: 'success',
          message: 'Stream key set successfully',
        });
      } catch (obsError: any) {
        logger.error('Failed to set stream key:', {
          error: obsError.message,
          settings: {
            protocol: req.body.protocol,
            host: settings.host,
            port: settings.port
          }
        });
        throw new AppError(500, `Failed to set stream key: ${obsError.message}`);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Stop stream
router.post(
  '/stream/stop',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await obsService.getSettings();
      if (!settings?.enabled) {
        throw new AppError(400, 'OBS integration is not enabled');
      }

      try {
        await obsService.connectToOBS(settings);
        await obsService.stopStream();
        await obsService.disconnectFromOBS();

        res.json({
          status: 'success',
          message: 'Stream stopped successfully',
        });
      } catch (obsError: any) {
        logger.error('Failed to stop stream:', {
          error: obsError.message,
          settings: {
            host: settings.host,
            port: settings.port
          }
        });
        throw new AppError(500, `Failed to stop stream: ${obsError.message}`);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get OBS connection status
router.get('/status', async (req, res) => {
  try {
    const status = obsService.getWebSocketStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get OBS status'
    });
  }
});

export default router; 