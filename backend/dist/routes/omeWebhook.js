"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
// import crypto from 'crypto';
const router = express_1.default.Router();
/**
 * Generate a signature for stream authentication
 * Kept for future use but currently not used
 */
/*
function generateSignature(streamKey: string): string {
  const secret = process.env.OME_SIGNATURE_SECRET || 'colourstream-signature-key';
  return crypto.createHmac('sha1', secret).update(streamKey).digest('hex');
}
*/
/**
 * OvenMediaEngine Webhook for validating stream keys
 * For details see: https://airensoft.gitbook.io/ovenmediaengine/access-control/admission-webhooks
 */
router.post('/admission', async (req, res) => {
    var _a;
    try {
        const body = req.body;
        logger_1.logger.info('AdmissionWebhook received request', { body });
        // Protocol and URL analysis
        if (body.request &&
            body.request.url &&
            body.request.direction &&
            body.request.status === 'opening') {
            const request = body.request;
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            const streamKey = pathParts[pathParts.length - 1];
            logger_1.logger.info('Processing stream key', {
                streamKey,
                protocol: request.protocol,
                direction: request.direction,
                url: request.url
            });
            // Development mode bypass - allow any stream key
            if (process.env.NODE_ENV !== 'production') {
                logger_1.logger.warn('DEVELOPMENT MODE: Allowing any stream key for testing', { streamKey });
                return res.json({
                    allowed: true,
                    new_url: request.url,
                    lifetime: 3600000,
                    reason: 'Development mode - all streams allowed'
                });
            }
            // Find an active room with this stream key
            const room = await prisma_1.default.room.findFirst({
                where: {
                    streamKey: streamKey,
                    expiryDate: {
                        gt: new Date()
                    }
                }
            });
            if (!room) {
                logger_1.logger.warn('Stream key not found in database', { streamKey });
                return res.json({
                    allowed: false,
                    reason: 'Invalid stream key'
                });
            }
            logger_1.logger.info('Valid stream key for room', { roomId: room.id, streamKey });
            // Format response based on protocol to ensure proper WebRTC signaling
            // Convert protocol to lowercase for case-insensitive comparison
            const protocolLower = ((_a = request.protocol) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
            if (protocolLower === 'webrtc') {
                logger_1.logger.info('Handling WebRTC connection', {
                    originalUrl: request.url,
                    protocol: request.protocol,
                    direction: request.direction
                });
                return res.json({
                    allowed: true,
                    new_url: request.url,
                    lifetime: 3600000 // Set a default lifetime of 1 hour
                });
            }
            else {
                // For non-WebRTC protocols (RTMP, SRT, etc.)
                logger_1.logger.info('Handling non-WebRTC connection', {
                    protocol: request.protocol,
                    direction: request.direction
                });
                return res.json({
                    allowed: true,
                    new_url: request.url
                });
            }
        }
        else if (body.request && body.request.status === 'closing') {
            // Stream is closing - just acknowledge
            return res.json({ allowed: true });
        }
        else {
            logger_1.logger.warn('Invalid webhook request format', { body });
            return res.status(400).json({
                allowed: false,
                reason: 'Invalid request format'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Error in admission webhook', { error });
        return res.status(500).json({
            allowed: false,
            reason: 'Internal server error'
        });
    }
});
exports.default = router;
