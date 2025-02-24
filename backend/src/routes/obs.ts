import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { obsService } from '../services/obsService';
import { logger } from '../utils/logger';

const router = express.Router();

// Get OBS settings
router.get(
  '/settings',
  authenticateToken,
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
  authenticateToken,
  [
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    body('streamType').equals('rtmp_custom').withMessage('Stream type must be rtmp_custom'),
    body('protocol').isIn(['rtmp', 'srt']).withMessage('Protocol must be rtmp or srt'),
    body('useLocalNetwork').isBoolean().withMessage('useLocalNetwork must be a boolean'),
    body('localNetworkMode').isIn(['frontend', 'backend']).withMessage('localNetworkMode must be frontend or backend'),
    // Host validation depends on mode
    body().custom((body) => {
      if (body.localNetworkMode === 'backend') {
        if (!body.localNetworkHost) {
          throw new Error('Host is required for backend mode');
        }
        if (!body.localNetworkPort || !Number.isInteger(body.localNetworkPort) || body.localNetworkPort < 1) {
          throw new Error('Valid port is required for backend mode');
        }
      }
      return true;
    })
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error: ' + errors.array().map(err => err.msg).join(', '));
      }

      const settings = await obsService.updateSettings(req.body);
      res.json({
        status: 'success',
        data: { settings },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Set stream key in OBS
router.post(
  '/set-stream-key',
  authenticateToken,
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
        port: settings.port,
        useLocalNetwork: settings.useLocalNetwork,
        localNetworkMode: settings.localNetworkMode
      });

      // Update the settings with the current protocol
      await obsService.updateSettings({
        ...settings,
        protocol: req.body.protocol
      });

      try {
        await obsService.connect(settings.host, settings.port, settings.password || undefined);
        await obsService.setStreamKey(req.body.streamKey);
        await obsService.disconnect();

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
            port: settings.port,
            useLocalNetwork: settings.useLocalNetwork,
            localNetworkMode: settings.localNetworkMode
          }
        });
        throw new AppError(500, `Failed to set stream key: ${obsError.message}`);
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router; 