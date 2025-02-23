import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { obsService } from '../services/obsService';

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
    body('host').notEmpty().withMessage('Host is required'),
    body('port').isInt({ min: 1 }).withMessage('Port must be a positive number'),
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
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
    body('streamType').isIn(['rtmp', 'srt']).withMessage('Stream type must be either rtmp or srt'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const settings = await obsService.getSettings();
      if (!settings?.enabled) {
        throw new AppError(400, 'OBS integration is not enabled');
      }

      // Update the settings with the current stream type
      await obsService.updateSettings({
        ...settings,
        streamType: req.body.streamType
      });

      await obsService.connect(settings.host, settings.port, settings.password || undefined);
      await obsService.setStreamKey(req.body.streamKey);
      await obsService.disconnect();

      res.json({
        status: 'success',
        message: 'Stream key set successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router; 