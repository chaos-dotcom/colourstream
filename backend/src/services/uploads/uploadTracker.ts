import { logger } from '../../utils/logger';
import { getTelegramBot } from '../telegram/telegramBot';

interface UploadInfo {
  id: string;
  size: number;
  offset: number;
  metadata?: Record<string, string>;
  createdAt: Date;
  lastUpdated: Date;
  previousOffset?: number; // Store previous offset for speed calculation
  previousUpdateTime?: Date; // Store previous time for speed calculation
  uploadSpeed?: number; // Speed in bytes per second
  storage?: string;
  isComplete: boolean;
  completedAt?: Date;
  terminated?: boolean; // Flag to indicate if upload was terminated
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
    // Store previous state for the *next* calculation
    const previousOffset = existingUpload?.offset;
    const previousUpdateTime = existingUpload?.lastUpdated;

    if (existingUpload && existingUpload.offset !== uploadInfo.offset && previousUpdateTime) {
      const timeDiffMs = now.getTime() - previousUpdateTime.getTime();
      // Ensure time difference is positive and offset has increased
      if (timeDiffMs > 50 && uploadInfo.offset > existingUpload.offset) { // Only calc speed if > 50ms passed & offset increased
        const bytesDiff = uploadInfo.offset - existingUpload.offset;
        uploadSpeed = (bytesDiff / timeDiffMs) * 1000; // Bytes per second
        console.log(`[TELEGRAM-DEBUG] Calculated upload speed for ${uploadInfo.id}: ${uploadSpeed.toFixed(2)} bytes/s`);
      } else if (timeDiffMs <= 50) {
         // If time diff is too small, reuse the previous speed if available
         uploadSpeed = existingUpload.uploadSpeed;
         console.log(`[TELEGRAM-DEBUG] Time diff too small, reusing previous speed for ${uploadInfo.id}: ${uploadSpeed?.toFixed(2)} bytes/s`);
      }
    }

    const updatedUpload: UploadInfo = {
      ...uploadInfo,
      lastUpdated: now,
      isComplete: uploadInfo.isComplete ?? false,
      createdAt: existingUpload?.createdAt || now,
      // Store the state *before* this update for the next calculation
      previousOffset: previousOffset,
      previousUpdateTime: previousUpdateTime,
      // Use newly calculated speed, or retain previous speed if calculation wasn't possible this interval
      uploadSpeed: uploadSpeed !== undefined ? uploadSpeed : existingUpload?.uploadSpeed
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
   * Mark an upload as terminated
   */
  markAsTerminated(id: string): boolean {
    const upload = this.uploads.get(id);
    if (!upload) {
      return false;
    }
    
    // Mark as terminated and keep in the tracker to prevent further processing
    upload.terminated = true;
    upload.lastUpdated = new Date();
    this.uploads.set(id, upload);
    
    logger.info(`Upload marked as terminated: ${id}`);
    return true;
  }
  
  /**
   * Remove an upload from tracking
   */
  removeUpload(id: string): boolean {
    if (!this.uploads.has(id)) {
      return false;
    }
    
    this.uploads.delete(id);
    return true;
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
