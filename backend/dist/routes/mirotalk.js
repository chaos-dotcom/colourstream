"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = express_1.default.Router();
// Helper function to convert expiration time to seconds
function getExpirationInSeconds(expireValue) {
    if (!expireValue)
        return 3600; // Default 1 hour
    const match = expireValue.match(/^(\d+)([hd])$/);
    if (!match)
        return 3600;
    const [, value, unit] = match;
    const numValue = parseInt(value, 10);
    if (unit === 'h')
        return numValue * 3600;
    if (unit === 'd')
        return numValue * 24 * 3600;
    return 3600;
}
// Create MiroTalk meeting URL
router.post('/join', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const { room, name, audio, video, screen, hide, notify, token, customUsername, customPassword } = req.body;
        // Log the incoming request for debugging
        logger_1.logger.debug('MiroTalk join request received:', {
            room,
            name,
            hasToken: !!token,
            customUsername: customUsername || '(empty)',
            customUsernameType: typeof customUsername,
            customUsernameLength: customUsername === null || customUsername === void 0 ? void 0 : customUsername.length,
            hasCustomPassword: customPassword ? true : false,
            customPasswordType: typeof customPassword,
            customPasswordLength: customPassword === null || customPassword === void 0 ? void 0 : customPassword.length
        });
        if (!process.env.JWT_KEY) {
            throw new errorHandler_1.AppError(500, 'JWT_KEY environment variable is not set');
        }
        // Determine token payload - use provided token or create one with custom credentials
        let tokenPayload;
        if (token) {
            // Use provided token
            tokenPayload = {
                username: token.username,
                password: token.password,
                presenter: token.presenter === "1" || token.presenter === "true" ? "true" : "false",
                expire: token.expire || "24h"
            };
            logger_1.logger.debug('Using provided token payload');
        }
        else {
            // Get username and password from custom parameters, environment, or use default
            // Treat empty strings as undefined
            let username = (customUsername && customUsername.trim() !== '') ? customUsername : undefined;
            let password = (customPassword && customPassword.trim() !== '') ? customPassword : undefined;
            logger_1.logger.debug('Processing custom credentials:', {
                username: username || '(undefined)',
                hasPassword: !!password
            });
            // If no custom credentials provided, try to get from environment
            if (!username || !password) {
                try {
                    if (process.env.HOST_USERS) {
                        // Remove any surrounding quotes that might be included in the env var
                        const cleanedHostUsers = process.env.HOST_USERS.replace(/^['"]|['"]$/g, '');
                        logger_1.logger.debug('Parsing HOST_USERS:', { cleanedHostUsers });
                        const parsedUsers = JSON.parse(cleanedHostUsers);
                        if (parsedUsers && parsedUsers.length > 0) {
                            if (!username) {
                                username = parsedUsers[0].username;
                                logger_1.logger.debug('Using username from HOST_USERS');
                            }
                            if (!password) {
                                password = parsedUsers[0].password;
                                logger_1.logger.debug('Using password from HOST_USERS');
                            }
                        }
                    }
                }
                catch (parseError) {
                    logger_1.logger.error('Error parsing HOST_USERS environment variable:', parseError);
                    // Continue with default values
                    if (!username) {
                        username = 'globalUsername';
                        logger_1.logger.debug('Using default username after error');
                    }
                    if (!password) {
                        password = 'globalPassword';
                        logger_1.logger.debug('Using default password after error');
                    }
                }
            }
            // Create token payload with custom or default credentials
            tokenPayload = {
                username,
                password,
                presenter: "true", // Default to presenter for direct join
                expire: "24h" // Default expiry
            };
        }
        logger_1.logger.debug('Creating MiroTalk token with payload', {
            username: tokenPayload.username,
            presenter: tokenPayload.presenter,
            expire: tokenPayload.expire,
            usingCustomCredentials: !!(customUsername && customUsername.trim() !== '' || customPassword && customPassword.trim() !== '')
        });
        // Encrypt payload using AES
        const payloadString = JSON.stringify(tokenPayload);
        const encryptedPayload = crypto_js_1.default.AES.encrypt(payloadString, process.env.JWT_KEY).toString();
        // Create JWT token with string expiration format as expected by MiroTalk
        // Convert the string expire value to a number of seconds for jwt.sign
        const expireInSeconds = getExpirationInSeconds(tokenPayload.expire);
        const jwtToken = jsonwebtoken_1.default.sign({ data: encryptedPayload }, process.env.JWT_KEY || '', { expiresIn: expireInSeconds });
        // Construct MiroTalk URL
        const mirotalkUrl = new URL('https://video.colourstream.johnrogerscolour.co.uk/join');
        mirotalkUrl.searchParams.append('room', room);
        mirotalkUrl.searchParams.append('name', name);
        mirotalkUrl.searchParams.append('audio', audio);
        mirotalkUrl.searchParams.append('video', video);
        mirotalkUrl.searchParams.append('screen', screen);
        mirotalkUrl.searchParams.append('hide', hide);
        mirotalkUrl.searchParams.append('notify', notify);
        mirotalkUrl.searchParams.append('token', jwtToken);
        mirotalkUrl.searchParams.append('_', Date.now().toString());
        mirotalkUrl.searchParams.append('fresh', '1');
        logger_1.logger.info('Generated MiroTalk URL', {
            room,
            name,
            presenter: tokenPayload.presenter,
            url: mirotalkUrl.toString()
        });
        res.json({
            status: 'success',
            data: {
                url: mirotalkUrl.toString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Generate one-time token for guests or presenters
router.post('/generate-token', auth_1.authenticateToken, async (req, res, next) => {
    try {
        const { roomId, name, isPresenter, expireTime = "1d", customUsername, customPassword } = req.body;
        // Log the incoming request for debugging
        logger_1.logger.debug('MiroTalk generate-token request received:', {
            roomId,
            name,
            isPresenter,
            expireTime,
            customUsername: customUsername || '(empty)',
            customUsernameType: typeof customUsername,
            customUsernameLength: customUsername === null || customUsername === void 0 ? void 0 : customUsername.length,
            hasCustomPassword: customPassword ? true : false,
            customPasswordType: typeof customPassword,
            customPasswordLength: customPassword === null || customPassword === void 0 ? void 0 : customPassword.length
        });
        if (!process.env.JWT_KEY) {
            throw new errorHandler_1.AppError(500, 'JWT_KEY environment variable is not set');
        }
        // Find the room to check its expiration date
        const room = await prisma_1.default.room.findUnique({
            where: {
                mirotalkRoomId: roomId
            }
        });
        if (!room) {
            throw new errorHandler_1.AppError(404, 'Room not found');
        }
        // Check if room has expired
        if (new Date() > new Date(room.expiryDate)) {
            throw new errorHandler_1.AppError(403, 'Room has expired');
        }
        // Calculate the maximum token expiration based on room expiry
        const roomExpiryMs = new Date(room.expiryDate).getTime() - Date.now();
        const roomExpiryDays = Math.floor(roomExpiryMs / (1000 * 60 * 60 * 24));
        const roomExpiryHours = Math.floor(roomExpiryMs / (1000 * 60 * 60));
        // Determine the appropriate expiration format
        let maxExpireTime;
        if (roomExpiryDays > 0) {
            maxExpireTime = `${roomExpiryDays}d`;
        }
        else {
            maxExpireTime = `${roomExpiryHours}h`;
        }
        // Ensure the requested expiration doesn't exceed the room expiration
        const requestedExpireSeconds = getExpirationInSeconds(expireTime);
        const maxExpireSeconds = getExpirationInSeconds(maxExpireTime);
        const finalExpireSeconds = Math.min(requestedExpireSeconds, maxExpireSeconds);
        // Convert back to a format string for the token payload
        const finalExpireTime = finalExpireSeconds > 24 * 3600
            ? `${Math.floor(finalExpireSeconds / (24 * 3600))}d`
            : `${Math.floor(finalExpireSeconds / 3600)}h`;
        // Get username and password from custom parameters, environment, or use default
        // Treat empty strings as undefined
        let username = (customUsername && customUsername.trim() !== '') ? customUsername : undefined;
        let password = (customPassword && customPassword.trim() !== '') ? customPassword : undefined;
        logger_1.logger.debug('Processing custom credentials:', {
            username: username || '(undefined)',
            hasPassword: !!password
        });
        // If no custom credentials provided, try to get from environment
        if (!username || !password) {
            try {
                if (process.env.HOST_USERS) {
                    // Remove any surrounding quotes that might be included in the env var
                    const cleanedHostUsers = process.env.HOST_USERS.replace(/^['"]|['"]$/g, '');
                    logger_1.logger.debug('Parsing HOST_USERS:', { cleanedHostUsers });
                    const parsedUsers = JSON.parse(cleanedHostUsers);
                    if (parsedUsers && parsedUsers.length > 0) {
                        if (!username) {
                            username = parsedUsers[0].username;
                            logger_1.logger.debug('Using username from HOST_USERS');
                        }
                        if (!password) {
                            password = parsedUsers[0].password;
                            logger_1.logger.debug('Using password from HOST_USERS');
                        }
                    }
                }
            }
            catch (parseError) {
                logger_1.logger.error('Error parsing HOST_USERS environment variable:', parseError);
                // Continue with default values
                if (!username) {
                    username = 'globalUsername';
                    logger_1.logger.debug('Using default username after error');
                }
                if (!password) {
                    password = 'globalPassword';
                    logger_1.logger.debug('Using default password after error');
                }
            }
        }
        // Construct token payload
        const tokenPayload = {
            username,
            password,
            presenter: isPresenter ? "true" : "false",
            expire: finalExpireTime
        };
        logger_1.logger.debug('Creating one-time token with payload', {
            username: tokenPayload.username,
            presenter: tokenPayload.presenter,
            expire: tokenPayload.expire,
            roomExpiry: maxExpireTime,
            usingCustomCredentials: !!(customUsername && customUsername.trim() !== '' || customPassword && customPassword.trim() !== '')
        });
        // Encrypt payload using AES
        const payloadString = JSON.stringify(tokenPayload);
        const encryptedPayload = crypto_js_1.default.AES.encrypt(payloadString, process.env.JWT_KEY).toString();
        // Create JWT token
        const jwtToken = jsonwebtoken_1.default.sign({ data: encryptedPayload }, process.env.JWT_KEY || '', { expiresIn: finalExpireSeconds });
        // Construct MiroTalk URL
        const mirotalkUrl = new URL('https://video.colourstream.johnrogerscolour.co.uk/join');
        mirotalkUrl.searchParams.append('room', roomId);
        mirotalkUrl.searchParams.append('name', name);
        mirotalkUrl.searchParams.append('audio', 'true');
        mirotalkUrl.searchParams.append('video', 'true');
        mirotalkUrl.searchParams.append('screen', 'false');
        mirotalkUrl.searchParams.append('hide', 'false');
        mirotalkUrl.searchParams.append('notify', 'true');
        mirotalkUrl.searchParams.append('token', jwtToken);
        mirotalkUrl.searchParams.append('_', Date.now().toString());
        mirotalkUrl.searchParams.append('fresh', '1');
        logger_1.logger.info('Generated one-time token URL', {
            room: roomId,
            name,
            presenter: tokenPayload.presenter,
            url: mirotalkUrl.toString(),
            expireTime: finalExpireTime,
            roomExpiryDate: room.expiryDate
        });
        res.json({
            status: 'success',
            data: {
                url: mirotalkUrl.toString(),
                token: jwtToken,
                expiresIn: finalExpireSeconds
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Add a new endpoint to get default MiroTalk credentials
router.get('/default-credentials', auth_1.authenticateToken, async (_req, res, next) => {
    try {
        // Default values if environment variable is not set or cannot be parsed
        let defaultCredentials = {
            username: 'globalUsername',
            password: 'globalPassword'
        };
        // Try to get credentials from environment
        try {
            if (process.env.HOST_USERS) {
                // Remove any surrounding quotes that might be included in the env var
                const cleanedHostUsers = process.env.HOST_USERS.replace(/^['"]|['"]$/g, '');
                const parsedUsers = JSON.parse(cleanedHostUsers);
                if (parsedUsers && parsedUsers.length > 0) {
                    defaultCredentials = {
                        username: parsedUsers[0].username,
                        password: parsedUsers[0].password
                    };
                }
            }
        }
        catch (parseError) {
            logger_1.logger.error('Error parsing HOST_USERS environment variable:', parseError);
            // Continue with default values
        }
        // Return the credentials
        res.json({
            status: 'success',
            data: {
                defaultCredentials
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
