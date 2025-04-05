import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth'; // Assuming admin routes need authentication
import { uploadTracker } from '../services/uploads/uploadTracker';
import { logger } from '../utils/logger';

const router = express.Router();

// GET endpoint to retrieve currently active uploads
router.get('/active-uploads', authenticateToken, (_req: Request, res: Response) => { // Prefix req with _
  try {
    const activeUploads = uploadTracker.getActiveUploads();
    logger.info(`Admin request for active uploads. Found: ${activeUploads.length}`);

    // Optionally filter or format the data before sending
    const responseData = activeUploads.map(upload => ({
      id: upload.id,
      fileName: upload.metadata?.filename || 'Unknown',
      size: upload.size,
      offset: upload.offset,
      percentage: upload.size > 0 ? Math.round((upload.offset / upload.size) * 100) : 0,
      speed: upload.uploadSpeed, // Speed in bytes/sec
      clientName: upload.metadata?.clientName || 'Unknown',
      projectName: upload.metadata?.projectName || 'Unknown',
      startTime: upload.createdAt,
      lastUpdate: upload.lastUpdated,
      storage: upload.metadata?.storage || 'unknown'
    }));

    res.json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    logger.error('Failed to get active uploads for admin:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve active uploads',
    });
  }
});

export default router;