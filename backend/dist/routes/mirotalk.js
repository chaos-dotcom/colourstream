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
        const { room, name, audio, video, screen, hide, notify, token } = req.body;
        if (!process.env.JWT_KEY) {
            throw new errorHandler_1.AppError(500, 'JWT_KEY environment variable is not set');
        }
        // Construct token payload
        const tokenPayload = {
            username: token.username,
            password: token.password,
            presenter: token.presenter,
        };
        // Encrypt payload using AES
        const payloadString = JSON.stringify(tokenPayload);
        const encryptedPayload = crypto_js_1.default.AES.encrypt(payloadString, process.env.JWT_KEY).toString();
        // Create JWT token with numeric expiration in seconds
        const expirationTime = getExpirationInSeconds(token.expire || process.env.JWT_EXP);
        const jwtToken = jsonwebtoken_1.default.sign({ data: encryptedPayload }, process.env.JWT_KEY, { expiresIn: expirationTime });
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
            presenter: token.presenter,
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
exports.default = router;
