"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const services_1 = require("../services");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
// Require authentication for all OBS routes
router.use(auth_1.authenticateToken);
// Get OBS settings
router.get('/settings', async (_req, res, next) => {
    try {
        const settings = await services_1.obsService.getSettings();
        res.json({
            status: 'success',
            data: { settings },
        });
    }
    catch (error) {
        next(error);
    }
});
// Update OBS settings
router.put('/settings', [
    (0, express_validator_1.body)('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    (0, express_validator_1.body)('streamType').equals('rtmp_custom').withMessage('Stream type must be rtmp_custom'),
    (0, express_validator_1.body)('protocol').isIn(['rtmp', 'srt']).withMessage('Protocol must be rtmp or srt'),
    // Make host validation conditional - only required if enabled is true
    (0, express_validator_1.body)('host').if((0, express_validator_1.body)('enabled').equals('true')).notEmpty().withMessage('Host is required when OBS integration is enabled'),
    // Port validation - only required if enabled is true
    (0, express_validator_1.body)('port').if((0, express_validator_1.body)('enabled').equals('true')).isInt({ min: 1 }).withMessage('Port must be a positive integer when OBS integration is enabled')
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error: ' + errors.array().map(err => err.msg).join(', '));
        }
        try {
            const settings = await services_1.obsService.updateSettings(req.body);
            // Return success response
            res.json({
                status: 'success',
                data: { settings },
                // Include a warning if connection test was skipped or failed
                warning: req.body.enabled && req.body.localNetworkMode === 'backend' ?
                    'Settings saved, but OBS connection could not be verified. Make sure OBS is running with WebSocket server enabled.' :
                    undefined
            });
        }
        catch (error) {
            // Pass through any OBS connection errors with their original message
            throw new errorHandler_1.AppError(500, error.message || 'Failed to connect to OBS');
        }
    }
    catch (error) {
        next(error);
    }
});
// Set stream key in OBS
router.post('/set-stream-key', [
    (0, express_validator_1.body)('streamKey').notEmpty().withMessage('Stream key is required'),
    (0, express_validator_1.body)('protocol').isIn(['rtmp', 'srt']).withMessage('Protocol must be either rtmp or srt'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error: ' + errors.array().map(err => err.msg).join(', '));
        }
        const settings = await services_1.obsService.getSettings();
        if (!(settings === null || settings === void 0 ? void 0 : settings.enabled)) {
            throw new errorHandler_1.AppError(400, 'OBS integration is not enabled');
        }
        logger_1.logger.info('Setting stream key with settings:', {
            protocol: req.body.protocol,
            host: settings.host,
            port: settings.port
        });
        // Update the settings with the current protocol
        await services_1.obsService.updateSettings({
            ...settings,
            protocol: req.body.protocol
        });
        try {
            await services_1.obsService.connectToOBS(settings);
            await services_1.obsService.setStreamKey(req.body.streamKey);
            await services_1.obsService.disconnectFromOBS();
            res.json({
                status: 'success',
                message: 'Stream key set successfully',
            });
        }
        catch (obsError) {
            logger_1.logger.error('Failed to set stream key:', {
                error: obsError.message,
                settings: {
                    protocol: req.body.protocol,
                    host: settings.host,
                    port: settings.port
                }
            });
            throw new errorHandler_1.AppError(500, `Failed to set stream key: ${obsError.message}`);
        }
    }
    catch (error) {
        next(error);
    }
});
// Stop stream
router.post('/stream/stop', async (_req, res, next) => {
    try {
        const settings = await services_1.obsService.getSettings();
        if (!(settings === null || settings === void 0 ? void 0 : settings.enabled)) {
            throw new errorHandler_1.AppError(400, 'OBS integration is not enabled');
        }
        try {
            await services_1.obsService.connectToOBS(settings);
            await services_1.obsService.stopStream();
            await services_1.obsService.disconnectFromOBS();
            res.json({
                status: 'success',
                message: 'Stream stopped successfully',
            });
        }
        catch (obsError) {
            logger_1.logger.error('Failed to stop stream:', {
                error: obsError.message,
                settings: {
                    host: settings.host,
                    port: settings.port
                }
            });
            throw new errorHandler_1.AppError(500, `Failed to stop stream: ${obsError.message}`);
        }
    }
    catch (error) {
        next(error);
    }
});
// Get OBS connection status
router.get('/status', async (_req, res) => {
    try {
        const status = services_1.obsService.getWebSocketStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get OBS status'
        });
    }
});
exports.default = router;
