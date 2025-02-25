"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const router = express_1.default.Router();
// Utility function to generate random IDs
const generateRandomId = (length = 12) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
// Utility function to generate stream key
const generateStreamKey = () => {
    return crypto_1.default.randomBytes(16).toString('hex');
};
// Utility function to generate MiroTalk token
const generateMiroTalkToken = async (roomId) => {
    try {
        if (!process.env.JWT_KEY) {
            throw new Error('JWT_KEY environment variable is not set');
        }
        const JWT_KEY = process.env.JWT_KEY;
        const username = `room_${roomId}`;
        const password = process.env.HOST_USERS ?
            JSON.parse(process.env.HOST_USERS)[0].password :
            'globalPassword';
        // Constructing payload
        const payload = {
            username: username,
            password: password,
            presenter: "1", // MiroTalk expects "1" or "true" as a string
            expire: "1d" // Match MiroTalk's expected format
        };
        // Encrypt payload using AES encryption
        const payloadString = JSON.stringify(payload);
        const encryptedPayload = crypto_js_1.default.AES.encrypt(payloadString, JWT_KEY).toString();
        // Constructing JWT token with numeric expiration
        const jwtToken = jsonwebtoken_1.default.sign({ data: encryptedPayload }, JWT_KEY, { expiresIn: 24 * 60 * 60 } // 24 hours in seconds
        );
        return jwtToken;
    }
    catch (error) {
        logger_1.logger.error('Error generating MiroTalk token:', error);
        throw new errorHandler_1.AppError(500, 'Failed to generate MiroTalk token');
    }
};
// Middleware to validate room ID
const validateRoomId = [
    (0, express_validator_1.param)('id').notEmpty().withMessage('Invalid room ID'),
];
// Middleware to validate room creation/update
const validateRoom = [
    (0, express_validator_1.body)('name').notEmpty().trim().withMessage('Name is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    (0, express_validator_1.body)('expiryDays').isInt({ min: 1 }).withMessage('Expiry days must be a positive number'),
];
// Create a new room (protected)
router.post('/', auth_1.authenticateToken, validateRoom, async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const { name, password, expiryDays } = req.body;
        // Generate random IDs
        const mirotalkRoomId = generateRandomId();
        const streamKey = generateStreamKey();
        // Generate MiroTalk token
        const mirotalkToken = await generateMiroTalkToken(mirotalkRoomId);
        // Hash the password
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const createData = {
            name,
            mirotalkRoomId,
            streamKey,
            password: hashedPassword,
            displayPassword: password,
            expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
            link: `${process.env.FRONTEND_URL}/room/${Math.random().toString(36).substr(2, 9)}`,
            mirotalkToken,
        };
        const room = await prisma_1.default.room.create({
            data: createData,
            select: {
                id: true,
                name: true,
                link: true,
                expiryDate: true,
                mirotalkRoomId: true,
                streamKey: true,
                displayPassword: true,
                mirotalkToken: true,
            },
        });
        res.status(201).json({
            status: 'success',
            data: { room },
        });
    }
    catch (error) {
        next(error);
    }
});
// Get all rooms (protected)
router.get('/', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        const rooms = await prisma_1.default.room.findMany({
            select: {
                id: true,
                name: true,
                link: true,
                expiryDate: true,
                mirotalkRoomId: true,
                streamKey: true,
                displayPassword: true,
            },
        });
        res.json({
            status: 'success',
            data: { rooms },
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete a room (protected)
router.delete('/:id', auth_1.authenticateToken, validateRoomId, async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const room = await prisma_1.default.room.delete({
            where: { id: req.params.id },
        });
        if (!room) {
            throw new errorHandler_1.AppError(404, 'Room not found');
        }
        res.json({
            status: 'success',
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
});
// Validate room access (public)
router.post('/validate/:id', [
    (0, express_validator_1.param)('id').notEmpty().withMessage('Room ID is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], async (req, res, next) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.AppError(400, 'Validation error');
        }
        const room = await prisma_1.default.room.findFirst({
            where: {
                link: { contains: req.params.id },
                expiryDate: { gt: new Date() },
            },
            select: {
                mirotalkRoomId: true,
                streamKey: true,
                mirotalkToken: true,
                password: true,
            },
        });
        if (!room) {
            throw new errorHandler_1.AppError(404, 'Room not found or expired');
        }
        const isValid = await bcryptjs_1.default.compare(req.body.password, room.password);
        if (!isValid) {
            throw new errorHandler_1.AppError(401, 'Invalid password');
        }
        res.json({
            status: 'success',
            data: {
                mirotalkRoomId: room.mirotalkRoomId,
                streamKey: room.streamKey,
                mirotalkToken: room.mirotalkToken,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Cleanup expired rooms (protected)
router.delete('/cleanup/expired', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        const result = await prisma_1.default.room.deleteMany({
            where: {
                expiryDate: { lt: new Date() },
            },
        });
        logger_1.logger.info(`Cleaned up ${result.count} expired rooms`);
        res.json({
            status: 'success',
            data: {
                deletedCount: result.count,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
