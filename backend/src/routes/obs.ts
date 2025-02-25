import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { obsService } from '../services/obsService';
import { logger } from '../utils/logger';
import { obsWebSocketManager } from '../services/obsWebSocket';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { getOBSSettings, updateOBSSettings } from '../services/obsSettings';

const router = express.Router();

// Middleware to handle WebSocket upgrade for OBS status
export const handleWebSocket = (ws: WebSocket, req: IncomingMessage) => {
  // Check authentication
  const token = req.url?.split('token=')[1];
  if (!token) {
    ws.close(1008, 'Authentication required');
    return;
  }

  // Add the client to the OBS WebSocket manager
  obsWebSocketManager.addClient(ws);
};

// Get current OBS connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = obsWebSocketManager.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Error getting OBS status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get OBS status' 
    });
  }
});

// Get OBS settings
router.get(
  '/settings',
  authenticateToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await getOBSSettings();
      res.json({
        status: 'success',
        data: { settings },
      });
    } catch (error) {
      console.error('Error getting OBS settings:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get OBS settings'
      });
    }
  }
);

// Update OBS settings and connection
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const settings = req.body;
    
    // Save settings first
    const savedSettings = await updateOBSSettings(settings);
    
    // If enabled and in backend mode, connect to OBS
    if (settings.enabled && settings.localNetworkMode === 'backend') {
      await obsWebSocketManager.connect({
        host: settings.host,
        port: settings.port,
        password: settings.password
      });
    } else {
      // If disabled or in frontend mode, disconnect from OBS
      await obsWebSocketManager.disconnect();
    }
    
    res.json({ 
      success: true, 
      data: { settings: savedSettings }
    });
  } catch (error: any) {
    console.error('Error updating OBS settings:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to update OBS settings'
    });
  }
});

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

// Stop stream
router.post(
  '/stream/stop',
  authenticateToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await obsService.getSettings();
      if (!settings?.enabled) {
        throw new AppError(400, 'OBS integration is not enabled');
      }

      try {
        await obsService.connect(settings.host, settings.port, settings.password || undefined);
        await obsService.stopStream();
        await obsService.disconnect();

        res.json({
          status: 'success',
          message: 'Stream stopped successfully',
        });
      } catch (obsError: any) {
        logger.error('Failed to stop stream:', {
          error: obsError.message,
          settings: {
            host: settings.host,
            port: settings.port,
            useLocalNetwork: settings.useLocalNetwork,
            localNetworkMode: settings.localNetworkMode
          }
        });
        throw new AppError(500, `Failed to stop stream: ${obsError.message}`);
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router; 