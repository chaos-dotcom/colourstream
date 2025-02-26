"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const prisma_1 = __importDefault(require("../lib/prisma"));
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const idGenerator_1 = require("../utils/idGenerator");
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
const generateMiroTalkToken = async (roomId, expiryDays, customUsername, customPassword) => {
    try {
        if (!process.env.JWT_KEY) {
            throw new Error('JWT_KEY environment variable is not set');
        }
        // Use the standard JWT_KEY
        const JWT_KEY = process.env.JWT_KEY;
        // Format username as expected by MiroTalk - use custom if provided, otherwise use room_roomId
        const username = customUsername || `room_${roomId}`;
        // Get password from custom parameter, environment, or use default
        let password = customPassword;
        if (!password) {
            password = process.env.HOST_USERS ?
                JSON.parse(process.env.HOST_USERS)[0].password :
                'globalPassword';
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
// Get all rooms
router.get("/", async (_req, res) => {
    try {
        const rooms = await prisma_1.default.room.findMany({
            orderBy: {
                createdAt: 'desc',
            },
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
        const { name, password, expiryDays, mirotalkUsername, mirotalkPassword } = req.body;
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
        let mirotalkToken;
        try {
            mirotalkToken = await generateMiroTalkToken(mirotalkRoomId, Number(expiryDays), mirotalkUsername, mirotalkPassword);
            logger_1.logger.info('Generated MiroTalk token for room', {
                roomId,
                mirotalkRoomId,
                customUsername: mirotalkUsername ? true : false
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
router.post("/validate/:id", async (req, res) => {
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
