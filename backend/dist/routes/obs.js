"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const obsService_1 = require("../services/obsService");
const router = express_1.default.Router();
// Get OBS settings
router.get('/settings', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        const settings = await obsService_1.obsService.getSettings();
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
router.put('/settings', auth_1.authenticateToken, [
    (0, express_validator_1.body)('host').notEmpty().withMessage('Host is required'),
    (0, express_validator_1.body)('port').isInt({ min: 1 }).withMessage('Port must be a positive number'),
    (0, express_validator_1.body)('enabled').isBoolean().withMessage('Enabled must be a boolean'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const settings = await obsService_1.obsService.updateSettings(req.body);
        res.json({
            status: 'success',
            data: { settings },
        });
    }
    catch (error) {
        next(error);
    }
});
// Set stream key in OBS
router.post('/set-stream-key', auth_1.authenticateToken, [
    (0, express_validator_1.body)('streamKey').notEmpty().withMessage('Stream key is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const settings = await obsService_1.obsService.getSettings();
        if (!(settings === null || settings === void 0 ? void 0 : settings.enabled)) {
            throw new errorHandler_1.AppError(400, 'OBS integration is not enabled');
        }
        await obsService_1.obsService.connect(settings.host, settings.port, settings.password || undefined);
        await obsService_1.obsService.setStreamKey(req.body.streamKey);
        await obsService_1.obsService.disconnect();
        res.json({
            status: 'success',
            message: 'Stream key set successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
