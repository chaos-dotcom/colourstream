import { logger } from '../../utils/logger';
import { getTelegramBot } from '../telegram/telegramBot';

interface UploadInfo {
  id: string;
  size: number;
  offset: number;
  metadata?: Record<string, string>;
  createdAt: Date;
  lastUpdated: Date;
  previousOffset?: number;
  previousUpdateTime?: Date;
  uploadSpeed?: number; // Speed in bytes per second
  storage?: string;
  isComplete: boolean;
  completedAt?: Date;
}

class UploadTracker {
  private uploads: Map<string, UploadInfo> = new Map();
  
  /**
   * Register a new upload or update an existing one
   */
  trackUpload(uploadInfo: Omit<UploadInfo, 'lastUpdated' | 'isComplete'> & { isComplete?: boolean }): void {
    const now = new Date();
    const existingUpload = this.uploads.get(uploadInfo.id);
    
    console.log('[TELEGRAM-DEBUG] trackUpload called for ID:', uploadInfo.id);
    
    // Calculate upload speed if this is an update
    let uploadSpeed: number | undefined = undefined;
    
    if (existingUpload && existingUpload.offset !== uploadInfo.offset) {
      const timeDiffMs = now.getTime() - existingUpload.lastUpdated.getTime();
      if (timeDiffMs > 0) {
        // Only calculate speed if some time has passed (avoid division by zero)
        const bytesDiff = uploadInfo.offset - existingUpload.offset;
        // Convert to bytes per second
        uploadSpeed = (bytesDiff / timeDiffMs) * 1000;
        console.log(`[TELEGRAM-DEBUG] Calculated upload speed for ${uploadInfo.id}: ${uploadSpeed.toFixed(2)} bytes/s`);
      }
    }
    
    const updatedUpload: UploadInfo = {
      ...uploadInfo,
      lastUpdated: now,
      isComplete: uploadInfo.isComplete ?? false,
      createdAt: existingUpload?.createdAt || now,
      previousOffset: existingUpload?.offset,
      previousUpdateTime: existingUpload?.lastUpdated,
      uploadSpeed
    };
    
    this.uploads.set(uploadInfo.id, updatedUpload);
    
    // Send notification via Telegram if configured
    const telegramBot = getTelegramBot();
    console.log('[TELEGRAM-DEBUG] getTelegramBot() returned:', telegramBot ? 'Bot instance available' : 'No bot instance');
    
    if (telegramBot) {
      console.log('[TELEGRAM-DEBUG] Calling sendUploadNotification for upload:', uploadInfo.id);
      telegramBot.sendUploadNotification(updatedUpload)
        .then(success => console.log('[TELEGRAM-DEBUG] sendUploadNotification result:', success ? 'Success' : 'Failed'))
        .catch((err: Error) => { // Type the error parameter
          console.error('[TELEGRAM-DEBUG] Failed to send upload notification to Telegram:', err);
          logger.error('Failed to send upload notification to Telegram:', err);
        });
    }
    
    logger.info(`Upload tracked: ${uploadInfo.id} - ${Math.round((uploadInfo.offset / uploadInfo.size) * 100)}% complete`);
  }
  
  /**
   * Mark an upload as complete
   */
  completeUpload(id: string): void {
    const upload = this.uploads.get(id);
    console.log('[TELEGRAM-DEBUG] completeUpload called for ID:', id, 'upload exists:', !!upload);
    
    if (upload) {
      const completedUpload: UploadInfo = {
        ...upload,
        offset: upload.size,
        lastUpdated: new Date(),
        isComplete: true,
        completedAt: new Date()
      };
      
      this.uploads.set(id, completedUpload);
      
      // Send completion notification via Telegram
      const telegramBot = getTelegramBot();
      console.log('[TELEGRAM-DEBUG] getTelegramBot() returned:', telegramBot ? 'Bot instance available' : 'No bot instance');
      
      if (telegramBot) {
        console.log('[TELEGRAM-DEBUG] Calling sendUploadNotification for completed upload:', id);
        // We'll use the same upload ID to ensure message editing occurs
        telegramBot.sendUploadNotification(completedUpload)
          .then(async (success) => { // Make async to await cleanup
              console.log('[TELEGRAM-DEBUG] sendUploadNotification result:', success ? 'Success' : 'Failed');
              if (success) {
                  // Clean up the message ID storage after successful completion notification
                  console.log(`[TELEGRAM-DEBUG] Cleaning up message ID for completed upload: ${id}`);
                  await telegramBot.cleanupUploadMessage(id);
              }
          })
          .catch((err: Error) => { // Type the error parameter
            console.error('[TELEGRAM-DEBUG] Failed to send completion notification to Telegram:', err);
            logger.error('Failed to send completion notification to Telegram:', err);
          });
      }
      
      logger.info(`Upload completed: ${id}`);
      
      // If this is an S3 upload, trigger cleanup to fix UUIDs in filenames
      console.log('[DEBUG] Upload metadata:', upload.metadata);
      console.log('[DEBUG] Storage value:', upload.metadata?.storage);
      
      // Disable automatic S3 cleanup trigger for new uploads, as the key should be correct initially.
      // The cleanup script can be run manually if needed for legacy files.
      // if (upload.metadata?.storage === 's3' && upload.metadata?.token) {
      //   console.log('[DEBUG] Will trigger S3 cleanup for upload:', id);
      //   this.triggerS3Cleanup(id, upload.metadata.token);
      // } else {
      //   console.log('[DEBUG] Skipping S3 cleanup for upload:', id, 'as storage is not s3 or token is missing');
      // }
    } else {
      logger.warn(`Attempted to complete unknown upload: ${id}`);
    }
  }
  
  /**
   * Get information about a specific upload
   */
  getUpload(id: string): UploadInfo | undefined {
    return this.uploads.get(id);
  }
  
  /**
   * Get all active uploads (not completed)
   */
  getActiveUploads(): UploadInfo[] {
    return Array.from(this.uploads.values())
      .filter(upload => !upload.isComplete);
  }
  
  /**
   * Get all uploads (active and completed)
   */
  getAllUploads(): UploadInfo[] {
    return Array.from(this.uploads.values());
  }
  
  /**
   * Remove old completed uploads to prevent memory leaks
   * This should be called periodically
   */
  cleanupOldUploads(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = new Date().getTime();
    let cleanupCount = 0;
    
    this.uploads.forEach((upload, id) => {
      if (upload.isComplete && (now - upload.lastUpdated.getTime() > maxAgeMs)) {
        this.uploads.delete(id);
        cleanupCount++;
      }
    });
    
    if (cleanupCount > 0) {
      logger.info(`Cleaned up ${cleanupCount} old completed uploads`);
    }
  }
}

// Singleton instance
export const uploadTracker = new UploadTracker();
