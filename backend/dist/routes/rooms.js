"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import { body, param } from 'express-validator';
// import bcrypt from 'bcryptjs';
// import { authenticateToken } from '../middleware/auth';
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
// import fetch from 'node-fetch';
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const idGenerator_1 = require("../utils/idGenerator");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = express_1.default.Router();
// Special rate limiter for room validation - higher limits than general
const roomValidationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Allow 50 validation attempts per 5 minutes
    message: 'Too many room validation attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// These are for documentation purposes only
/* interface _ValidateRoomBody {
  password: string;
  isPresenter?: boolean;
} */
// Middleware definitions for documentation purposes only
/* const _validateRoomId = [
  param('id').notEmpty().withMessage('Invalid room ID'),
];

const _validateRoom = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('expiryDays').isInt({ min: 1 }).withMessage('Expiry days must be a positive number'),
]; */
// Utility function to generate MiroTalk token
const generateMiroTalkToken = async (roomId, expiryDays, customUsername, customPassword) => {
    try {
        if (!process.env.JWT_KEY) {
            throw new Error('JWT_KEY environment variable is not set');
        }
        // Use the standard JWT_KEY
        const JWT_KEY = process.env.JWT_KEY;
        // Log the incoming parameters for debugging
        logger_1.logger.debug('generateMiroTalkToken called with params:', {
            roomId,
            expiryDays,
            useDefaultCredentials: !customUsername && !customPassword
        });
        // Default username and password
        let username = `room_${roomId}`;
        let password = 'globalPassword';
        // Try to get default credentials from HOST_USERS environment variable
        try {
            if (process.env.HOST_USERS) {
                // Remove any surrounding quotes that might be included in the env var
                const cleanedHostUsers = process.env.HOST_USERS.replace(/^['"]|['"]$/g, '');
                logger_1.logger.debug('Parsing HOST_USERS:', { cleanedHostUsers });
                const parsedUsers = JSON.parse(cleanedHostUsers);
                if (parsedUsers && parsedUsers.length > 0) {
                    // Only override username if customUsername is provided and not empty
                    if (customUsername && customUsername.trim() !== '') {
                        username = customUsername;
                        logger_1.logger.debug('Using custom username:', { username });
                    }
                    else {
                        // Otherwise use the default username from HOST_USERS
                        username = parsedUsers[0].username || username;
                        logger_1.logger.debug('Using default username from HOST_USERS');
                    }
                    // Only override password if customPassword is provided and not empty
                    if (customPassword && customPassword.trim() !== '') {
                        password = customPassword;
                        logger_1.logger.debug('Using custom password');
                    }
                    else {
                        // Otherwise use the default password from HOST_USERS
                        password = parsedUsers[0].password || password;
                        logger_1.logger.debug('Using default password from HOST_USERS');
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error parsing HOST_USERS environment variable:', error);
            // Continue with default values already set
            logger_1.logger.debug('Using fallback default credentials after error');
        }
        // Set expiration to match room expiry (default to 30 days if not specified)
        const expireDays = expiryDays || 30;
        const expireValue = `${expireDays}d`;
        // Constructing payload - MiroTalk expects presenter as a string "true" or "1"
        const payload = {
            username: username,
            password: password,
            presenter: "true", // MiroTalk expects "true" or "1" as a string
            expire: expireValue // Match room expiration
        };
        logger_1.logger.debug('Final token payload:', {
            username: payload.username,
            hasPassword: !!payload.password,
            presenter: payload.presenter,
            expire: payload.expire
        });
        // Encrypt payload using AES encryption
        const payloadString = JSON.stringify(payload);
        const encryptedPayload = crypto_js_1.default.AES.encrypt(payloadString, JWT_KEY).toString();
        // Constructing JWT token with expiration matching room expiry
        const jwtToken = jsonwebtoken_1.default.sign({ data: encryptedPayload }, JWT_KEY, { expiresIn: `${expireDays}d` } // Use room expiry
        );
        logger_1.logger.info('Generated MiroTalk token', {
            roomId,
            username,
            tokenExpiry: expireValue
        });
        return jwtToken;
    }
    catch (error) {
        logger_1.logger.error('Error generating MiroTalk token:', error);
        throw new errorHandler_1.AppError(500, 'Failed to generate MiroTalk token');
    }
};
// Get all rooms
router.get("/", async (_req, res) => {
    try {
        const rooms = await prisma_1.default.room.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                name: true,
                mirotalkRoomId: true,
                streamKey: true,
                password: true, // Include the actual password
                displayPassword: true,
                expiryDate: true,
                link: true,
                presenterLink: true,
                mirotalkToken: true,
                createdAt: true
            }
        });
        return res.status(200).json({
            status: 'success',
            data: { rooms }
        });
    }
    catch (error) {
        console.error("Error fetching rooms:", error);
        return res.status(500).json({ error: "Failed to fetch rooms" });
    }
});
// Create a new room
router.post("/", async (req, res) => {
    try {
        const { name, password, expiryDays } = req.body;
        // Log the incoming request for debugging
        logger_1.logger.debug('Room creation request received:', {
            name,
            hasPassword: !!password,
            expiryDays
        });
        // Validate required fields
        if (!name || !password || !expiryDays) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // Calculate expiry date from expiryDays
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + Number(expiryDays));
        // Generate unique IDs and tokens
        const mirotalkRoomId = (0, idGenerator_1.generateUniqueId)();
        const streamKey = (0, idGenerator_1.generateUniqueId)();
        const displayPassword = password.substring(0, 3) + "***";
        // Generate room ID
        const roomId = (0, idGenerator_1.generateUniqueId)();
        // Generate links using the room ID
        const link = `${process.env.FRONTEND_URL}/room/${roomId}`;
        const presenterLink = `${process.env.FRONTEND_URL}/room/${roomId}?access=p`;
        // Generate MiroTalk token that expires at the same time as the room
        // Always use default credentials from HOST_USERS
        let mirotalkToken;
        try {
            mirotalkToken = await generateMiroTalkToken(mirotalkRoomId, Number(expiryDays), undefined, // Force using default username from HOST_USERS
            undefined // Force using default password from HOST_USERS
            );
            logger_1.logger.info('Generated MiroTalk token for room using default credentials', {
                roomId,
                mirotalkRoomId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to generate MiroTalk token', { error });
            // Continue without token if generation fails
        }
        // Create room data
        const roomData = {
            id: roomId, // Use the generated ID
            name,
            mirotalkRoomId,
            streamKey,
            password,
            displayPassword,
            expiryDate,
            link,
            presenterLink,
            mirotalkToken, // Always include the token
        };
        const room = await prisma_1.default.room.create({
            data: roomData,
        });
        return res.status(201).json({
            status: 'success',
            data: { room }
        });
    }
    catch (error) {
        console.error("Error creating room:", error);
        return res.status(500).json({ error: "Failed to create room" });
    }
});
// Get a specific room
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const room = await prisma_1.default.room.findUnique({
            where: {
                id: String(id),
            },
        });
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }
        return res.status(200).json(room);
    }
    catch (error) {
        console.error("Error fetching room:", error);
        return res.status(500).json({ error: "Failed to fetch room" });
    }
});
// Validate room access
router.get("/validate", async (req, res) => {
    try {
        const { roomId, password, presenterLink: isPresenterLink } = req.query;
        if (!roomId) {
            return res.status(400).json({ error: "Room ID is required" });
        }
        let room;
        try {
            // Find the room by mirotalkRoomId
            room = await prisma_1.default.room.findUnique({
                where: {
                    mirotalkRoomId: roomId,
                },
            });
        }
        catch (error) {
            console.error("Error finding room by mirotalkRoomId:", error);
            room = null;
        }
        if (!room) {
            return res.status(404).json({ error: "Room not found" });
        }
        // Check if room has expired
        if (new Date() > new Date(room.expiryDate)) {
            return res.status(403).json({ error: "Room has expired" });
        }
        // If password is provided, validate it
        if (password && password !== room.password) {
            return res.status(403).json({ error: "Invalid password" });
        }
        // Return room data
        return res.status(200).json({
            status: 'success',
            data: {
                mirotalkRoomId: room.mirotalkRoomId,
                streamKey: room.streamKey,
                mirotalkToken: room.mirotalkToken,
                isPresenter: isPresenterLink === "true"
            }
        });
    }
    catch (error) {
        console.error("Error validating room:", error);
        return res.status(500).json({ error: "Failed to validate room" });
    }
});
// Add a POST endpoint for room validation
router.post("/validate/:id", roomValidationLimiter, async (req, res, _next) => {
    try {
        const { id } = req.params;
        const { password, isPresenter } = req.body;
        if (!id) {
            return res.status(400).json({ error: "Room ID is required" });
        }
        let room;
        try {
            // First try to find by mirotalkRoomId
            room = await prisma_1.default.room.findUnique({
                where: {
                    mirotalkRoomId: id,
                },
            });
            // If not found, try by room ID
            if (!room) {
                room = await prisma_1.default.room.findUnique({
                    where: {
                        id: id,
                    },
                });
            }
        }
        catch (error) {
            console.error("Error finding room:", error);
            room = null;
        }
        if (!room) {
            return res.status(404).json({
                status: 'error',
                message: "Room not found"
            });
        }
        // Check if room has expired
        if (new Date() > new Date(room.expiryDate)) {
            return res.status(403).json({
                status: 'error',
                message: "Room has expired"
            });
        }
        // If password is provided, validate it
        if (password && password !== room.password) {
            return res.status(403).json({
                status: 'error',
                message: "Invalid password"
            });
        }
        // Return room data
        return res.status(200).json({
            status: 'success',
            data: {
                mirotalkRoomId: room.mirotalkRoomId,
                streamKey: room.streamKey,
                mirotalkToken: room.mirotalkToken,
                isPresenter: isPresenter === true
            }
        });
    }
    catch (error) {
        console.error("Error validating room:", error);
        return res.status(500).json({
            status: 'error',
            message: "Failed to validate room"
        });
    }
});
// Delete a room
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.room.delete({
            where: {
                id: String(id),
            },
        });
        return res.status(204).send();
    }
    catch (error) {
        console.error("Error deleting room:", error);
        return res.status(500).json({ error: "Failed to delete room" });
    }
});
exports.default = router;
