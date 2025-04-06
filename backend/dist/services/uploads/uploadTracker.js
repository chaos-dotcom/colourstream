"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTracker = void 0;
const logger_1 = require("../../utils/logger");
const telegramBot_1 = require("../telegram/telegramBot");
class UploadTracker {
    constructor() {
        this.uploads = new Map();
    }
    /**
     * Register a new upload or update an existing one
     */
    trackUpload(uploadInfo) {
        var _a;
        const now = new Date();
        const existingUpload = this.uploads.get(uploadInfo.id);
        console.log('[TELEGRAM-DEBUG] trackUpload called for ID:', uploadInfo.id);
        // Calculate upload speed if this is an update
        let uploadSpeed = undefined;
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
        const updatedUpload = {
            ...uploadInfo,
            lastUpdated: now,
            isComplete: (_a = uploadInfo.isComplete) !== null && _a !== void 0 ? _a : false,
            createdAt: (existingUpload === null || existingUpload === void 0 ? void 0 : existingUpload.createdAt) || now,
            previousOffset: existingUpload === null || existingUpload === void 0 ? void 0 : existingUpload.offset,
            previousUpdateTime: existingUpload === null || existingUpload === void 0 ? void 0 : existingUpload.lastUpdated,
            uploadSpeed
        };
        this.uploads.set(uploadInfo.id, updatedUpload);
        // Send notification via Telegram if configured
        const telegramBot = (0, telegramBot_1.getTelegramBot)();
        console.log('[TELEGRAM-DEBUG] getTelegramBot() returned:', telegramBot ? 'Bot instance available' : 'No bot instance');
        if (telegramBot) {
            console.log('[TELEGRAM-DEBUG] Calling sendUploadNotification for upload:', uploadInfo.id);
            telegramBot.sendUploadNotification(updatedUpload)
                .then(success => console.log('[TELEGRAM-DEBUG] sendUploadNotification result:', success ? 'Success' : 'Failed'))
                .catch(err => {
                console.error('[TELEGRAM-DEBUG] Failed to send upload notification to Telegram:', err);
                logger_1.logger.error('Failed to send upload notification to Telegram:', err);
            });
        }
        logger_1.logger.info(`Upload tracked: ${uploadInfo.id} - ${Math.round((uploadInfo.offset / uploadInfo.size) * 100)}% complete`);
    }
    /**
     * Mark an upload as complete
     */
    completeUpload(id) {
        var _a;
        const upload = this.uploads.get(id);
        console.log('[TELEGRAM-DEBUG] completeUpload called for ID:', id, 'upload exists:', !!upload);
        if (upload) {
            const completedUpload = {
                ...upload,
                offset: upload.size,
                lastUpdated: new Date(),
                isComplete: true,
                completedAt: new Date()
            };
            this.uploads.set(id, completedUpload);
            // Send completion notification via Telegram
            const telegramBot = (0, telegramBot_1.getTelegramBot)();
            console.log('[TELEGRAM-DEBUG] getTelegramBot() returned:', telegramBot ? 'Bot instance available' : 'No bot instance');
            if (telegramBot) {
                console.log('[TELEGRAM-DEBUG] Calling sendUploadNotification for completed upload:', id);
                // We'll use the same upload ID to ensure message editing occurs
                telegramBot.sendUploadNotification(completedUpload)
                    .then(success => console.log('[TELEGRAM-DEBUG] sendUploadNotification result:', success ? 'Success' : 'Failed'))
                    .catch(err => {
                    console.error('[TELEGRAM-DEBUG] Failed to send completion notification to Telegram:', err);
                    logger_1.logger.error('Failed to send completion notification to Telegram:', err);
                });
            }
            logger_1.logger.info(`Upload completed: ${id}`);
            // If this is an S3 upload, trigger cleanup to fix UUIDs in filenames
            console.log('[DEBUG] Upload metadata:', upload.metadata);
            console.log('[DEBUG] Storage value:', (_a = upload.metadata) === null || _a === void 0 ? void 0 : _a.storage);
            // Disable automatic S3 cleanup trigger for new uploads, as the key should be correct initially.
            // The cleanup script can be run manually if needed for legacy files.
            // if (upload.metadata?.storage === 's3' && upload.metadata?.token) {
            //   console.log('[DEBUG] Will trigger S3 cleanup for upload:', id);
            //   this.triggerS3Cleanup(id, upload.metadata.token);
            // } else {
            //   console.log('[DEBUG] Skipping S3 cleanup for upload:', id, 'as storage is not s3 or token is missing');
            // }
        }
        else {
            logger_1.logger.warn(`Attempted to complete unknown upload: ${id}`);
        }
    }
    /**
     * Get information about a specific upload
     */
    getUpload(id) {
        return this.uploads.get(id);
    }
    /**
     * Get all active uploads (not completed)
     */
    getActiveUploads() {
        return Array.from(this.uploads.values())
            .filter(upload => !upload.isComplete);
    }
    /**
     * Get all uploads (active and completed)
     */
    getAllUploads() {
        return Array.from(this.uploads.values());
    }
    /**
     * Remove old completed uploads to prevent memory leaks
     * This should be called periodically
     */
    cleanupOldUploads(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = new Date().getTime();
        let cleanupCount = 0;
        this.uploads.forEach((upload, id) => {
            if (upload.isComplete && (now - upload.lastUpdated.getTime() > maxAgeMs)) {
                this.uploads.delete(id);
                cleanupCount++;
            }
        });
        if (cleanupCount > 0) {
            logger_1.logger.info(`Cleaned up ${cleanupCount} old completed uploads`);
        }
    }
}
// Singleton instance
exports.uploadTracker = new UploadTracker();
