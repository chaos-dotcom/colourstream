"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TusdHooksController = void 0;
const logger_1 = require("../utils/logger");
const uploadTracker_1 = require("../services/uploads/uploadTracker");
/**
 * Controller for handling tusd webhook events
 */
class TusdHooksController {
    /**
     * Handle pre-create hook
     * This is called before an upload is created
     */
    handlePreCreate(req, res) {
        var _a;
        try {
            const hookData = req.body;
            logger_1.logger.info('tusd pre-create hook received', { uploadId: (_a = hookData.Upload) === null || _a === void 0 ? void 0 : _a.ID });
            // You can validate the upload here and reject it if needed
            // For example, check file type, size limits, etc.
            res.status(200).json({ message: 'Pre-create hook processed' });
        }
        catch (error) {
            logger_1.logger.error('Error in pre-create hook:', error);
            res.status(500).json({ error: 'Failed to process pre-create hook' });
        }
    }
    /**
     * Handle post-create hook
     * This is called after an upload is created
     */
    handlePostCreate(req, res) {
        var _a, _b, _c;
        try {
            const hookData = req.body;
            const uploadId = (_a = hookData.Upload) === null || _a === void 0 ? void 0 : _a.ID;
            const size = ((_b = hookData.Upload) === null || _b === void 0 ? void 0 : _b.Size) || 0;
            const metadata = ((_c = hookData.Upload) === null || _c === void 0 ? void 0 : _c.MetaData) || {};
            logger_1.logger.info('tusd post-create hook received', { uploadId });
            // Track the new upload
            uploadTracker_1.uploadTracker.trackUpload({
                id: uploadId,
                size,
                offset: 0,
                metadata,
                createdAt: new Date(),
                isComplete: false
            });
            res.status(200).json({ message: 'Post-create hook processed' });
        }
        catch (error) {
            logger_1.logger.error('Error in post-create hook:', error);
            res.status(500).json({ error: 'Failed to process post-create hook' });
        }
    }
    /**
     * Handle post-receive hook
     * This is called after a chunk is received
     */
    handlePostReceive(req, res) {
        var _a, _b, _c, _d;
        try {
            const hookData = req.body;
            const uploadId = (_a = hookData.Upload) === null || _a === void 0 ? void 0 : _a.ID;
            const size = ((_b = hookData.Upload) === null || _b === void 0 ? void 0 : _b.Size) || 0;
            const offset = ((_c = hookData.Upload) === null || _c === void 0 ? void 0 : _c.Offset) || 0;
            const metadata = ((_d = hookData.Upload) === null || _d === void 0 ? void 0 : _d.MetaData) || {};
            logger_1.logger.debug('tusd post-receive hook received', {
                uploadId,
                progress: `${Math.round((offset / size) * 100)}%`
            });
            // Update the upload progress
            uploadTracker_1.uploadTracker.trackUpload({
                id: uploadId,
                size,
                offset,
                metadata,
                createdAt: new Date()
            });
            res.status(200).json({ message: 'Post-receive hook processed' });
        }
        catch (error) {
            logger_1.logger.error('Error in post-receive hook:', error);
            res.status(500).json({ error: 'Failed to process post-receive hook' });
        }
    }
    /**
     * Handle post-finish hook
     * This is called when an upload is completed
     */
    handlePostFinish(req, res) {
        var _a;
        try {
            const hookData = req.body;
            const uploadId = (_a = hookData.Upload) === null || _a === void 0 ? void 0 : _a.ID;
            logger_1.logger.info('tusd post-finish hook received', { uploadId });
            // Mark the upload as complete
            uploadTracker_1.uploadTracker.completeUpload(uploadId);
            res.status(200).json({ message: 'Post-finish hook processed' });
        }
        catch (error) {
            logger_1.logger.error('Error in post-finish hook:', error);
            res.status(500).json({ error: 'Failed to process post-finish hook' });
        }
    }
    /**
     * Handle post-terminate hook
     * This is called when an upload is terminated
     */
    handlePostTerminate(req, res) {
        var _a;
        try {
            const hookData = req.body;
            const uploadId = (_a = hookData.Upload) === null || _a === void 0 ? void 0 : _a.ID;
            logger_1.logger.info('tusd post-terminate hook received', { uploadId });
            // You can handle upload termination here
            // For example, clean up any associated resources
            res.status(200).json({ message: 'Post-terminate hook processed' });
        }
        catch (error) {
            logger_1.logger.error('Error in post-terminate hook:', error);
            res.status(500).json({ error: 'Failed to process post-terminate hook' });
        }
    }
}
exports.TusdHooksController = TusdHooksController;
