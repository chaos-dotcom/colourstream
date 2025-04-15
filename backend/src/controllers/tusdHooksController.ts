import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { uploadTracker } from '../services/uploads/uploadTracker';
import { getTelegramBot } from '../services/telegram/telegramBot';
// Removed unused axios import

/**
 * Format bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Calculate progress percentage
 */
function calculateProgress(current: number, total: number): number {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

/**
 * Controller for handling tusd webhook events
 */
export class TusdHooksController {
  /**
   * Handle pre-create hook
   * This is called before an upload is created
   */
  handlePreCreate(req: Request, res: Response): void {
    try {
      const hookData = req.body;
      logger.info('tusd pre-create hook received', { uploadId: hookData.Upload?.ID });
      
      // You can validate the upload here and reject it if needed
      // For example, check file type, size limits, etc.
      
      res.status(200).json({ message: 'Pre-create hook processed' });
    } catch (error) {
      logger.error('Error in pre-create hook:', error);
      res.status(500).json({ error: 'Failed to process pre-create hook' });
    }
  }
  
  /**
   * Handle post-create hook
   * This is called after an upload is created
   */
  handlePostCreate(req: Request, res: Response): void {
    try {
      const hookData = req.body;
      const uploadId = hookData.Upload?.ID;
      const size = hookData.Upload?.Size || 0;
      const metadata = hookData.Upload?.MetaData || {};
      
      logger.info('tusd post-create hook received', { uploadId });
      
      // Track the new upload
      uploadTracker.trackUpload({
        id: uploadId,
        size,
        offset: 0,
        metadata,
        createdAt: new Date(),
        isComplete: false
      });
      
      res.status(200).json({ message: 'Post-create hook processed' });
    } catch (error) {
      logger.error('Error in post-create hook:', error);
      res.status(500).json({ error: 'Failed to process post-create hook' });
    }
  }
  
  /**
   * Handle post-receive hook
   * This is called after a chunk is received
   */
  handlePostReceive(req: Request, res: Response): void {
    try {
      const hookData = req.body;
      const uploadId = hookData.Upload?.ID;
      const size = hookData.Upload?.Size || 0;
      const offset = hookData.Upload?.Offset || 0;
      const metadata = hookData.Upload?.MetaData || {};
      
      logger.debug('tusd post-receive hook received', { 
        uploadId, 
        progress: `${Math.round((offset / size) * 100)}%` 
      });
      
      // Check if this upload has been terminated
      // If it has, we should not process any more receive hooks
      const uploadInfo = uploadTracker.getUpload(uploadId);
      if (uploadInfo?.terminated) {
        logger.info(`Ignoring post-receive hook for terminated upload ${uploadId}`);
        res.status(200).json({ message: 'Upload already terminated, hook ignored' });
        return;
      }
      
      // Update the upload progress
      uploadTracker.trackUpload({
        id: uploadId,
        size,
        offset,
        metadata,
        createdAt: new Date()
      });
      
      res.status(200).json({ message: 'Post-receive hook processed' });
    } catch (error) {
      logger.error('Error in post-receive hook:', error);
      res.status(500).json({ error: 'Failed to process post-receive hook' });
    }
  }
  
  /**
   * Handle post-finish hook
   * This is called when an upload is completed
   */
  handlePostFinish(req: Request, res: Response): void {
    try {
      const hookData = req.body;
      const uploadId = hookData.Upload?.ID;
      
      logger.info('tusd post-finish hook received', { uploadId });
      
      // Mark the upload as complete
      uploadTracker.completeUpload(uploadId);
      
      res.status(200).json({ message: 'Post-finish hook processed' });
    } catch (error) {
      logger.error('Error in post-finish hook:', error);
      res.status(500).json({ error: 'Failed to process post-finish hook' });
    }
  }
  
  /**
   * Handle post-terminate hook
   * This is called when an upload is terminated
   */
  handlePostTerminate(req: Request, res: Response): void {
    try {
      const hookData = req.body;
      const uploadId = hookData.Upload?.ID;
      const size = hookData.Upload?.Size || 0;
      const offset = hookData.Upload?.Offset || 0;
      const metadata = hookData.Upload?.MetaData || {};
      
      logger.info('tusd post-terminate hook received', { uploadId, size, offset });
      
      // Get the upload info from the tracker before removing it
      const uploadInfo = uploadTracker.getUpload(uploadId);
      
      // Get the telegram bot service
      const telegramBot = getTelegramBot();
      
      // If we have a telegram bot instance, notify about the termination
      if (telegramBot) {
        logger.info(`Notifying Telegram about terminated upload ${uploadId}`);
        
        // Use the metadata from the upload tracker if available, as it might have more info
        const enhancedMetadata = uploadInfo?.metadata || metadata;
        
        // Create the termination message
        const terminatedMessage = `<b>❌ Upload Terminated</b>\n` +
          `<b>File:</b> ${enhancedMetadata?.filename || 'Unknown File'}\n` +
          `<b>Size:</b> ${formatFileSize(size || 0)}\n` +
          `<b>Progress:</b> Cancelled at ${calculateProgress(offset || 0, size || 0)}% (${formatFileSize(offset || 0)} / ${formatFileSize(size || 0)})\n` +
          `<b>Client:</b> ${enhancedMetadata?.clientName || enhancedMetadata?.client || 'Unknown Client'}\n` +
          `<b>Project:</b> ${enhancedMetadata?.projectName || enhancedMetadata?.project || 'Unknown Project'}\n` +
          `<b>Terminated at:</b> ${new Date().toLocaleString()}`;

        // Send the termination message using the dedicated method in TelegramBot
        // This method handles sending a *new* message and cleaning up the old message ID.
        console.log(`[TELEGRAM-DEBUG] Calling telegramBot.sendTerminationMessage for upload ${uploadId}`);
        telegramBot.sendTerminationMessage(uploadId, terminatedMessage)
          .then(success => {
            if (success) {
              logger.info(`Successfully processed termination notification for upload ${uploadId}`);
            } else {
              logger.error(`Failed to send termination notification via TelegramBot for upload ${uploadId}`);
            }
          })
          .catch(err => {
            // Catch potential errors from the promise itself, though sendTerminationMessage handles internal errors
            logger.error(`Error calling sendTerminationMessage for upload ${uploadId}:`, err);
            console.error(`[TELEGRAM-DEBUG] Error calling sendTerminationMessage for ${uploadId}:`, err);
          });
      } else {
         logger.warn(`Telegram bot instance not available, cannot send termination notification for upload ${uploadId}`);
      }

      // Mark the upload as terminated in the tracker.
      // This should happen regardless of whether the Telegram notification succeeded.
      // This will allow us to ignore subsequent post-receive hooks
      if (uploadInfo) {
        uploadTracker.markAsTerminated(uploadId);
      }
      
      res.status(200).json({ message: 'Post-terminate hook processed' });
    } catch (error) {
      logger.error('Error in post-terminate hook:', error);
      res.status(500).json({ error: 'Failed to process post-terminate hook' });
    }
  }
} 
