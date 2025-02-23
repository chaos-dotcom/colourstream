"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const errorHandler_1 = require("../middleware/errorHandler");
const auth_1 = require("../middleware/auth");
const updateEnvFile_1 = require("../utils/updateEnvFile");
const security_1 = require("../middleware/security");
const router = express_1.default.Router();
router.post('/login', security_1.loginLimiter, security_1.trackLoginAttempts, [
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { password } = req.body;
        const storedHash = process.env.ADMIN_PASSWORD_HASH;
        if (!storedHash) {
            throw new errorHandler_1.AppError(500, 'Admin password hash not configured');
        }
        const isValid = await bcryptjs_1.default.compare(password, storedHash);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Invalid password');
        }
        const token = jsonwebtoken_1.default.sign({ userId: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            status: 'success',
            data: {
                token,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/change-password', auth_1.authenticateToken, [
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .notEmpty()
        .withMessage('New password is required')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { currentPassword, newPassword } = req.body;
        const storedHash = process.env.ADMIN_PASSWORD_HASH;
        if (!storedHash) {
            throw new errorHandler_1.AppError(500, 'Admin password hash not configured');
        }
        // Verify current password
        const isValid = await bcryptjs_1.default.compare(currentPassword, storedHash);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Current password is incorrect');
        }
        // Generate new hash
        const newHash = await bcryptjs_1.default.hash(newPassword, 12);
        // Update .env file
        await (0, updateEnvFile_1.updatePasswordHash)(newHash);
        // Update environment variable
        process.env.ADMIN_PASSWORD_HASH = newHash;
        res.json({
            status: 'success',
            message: 'Password changed successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
