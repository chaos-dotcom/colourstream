"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
// import * as crypto from 'crypto';
const prisma = new client_1.PrismaClient();
/**
 * Utility function to generate a stream key - for future reference only
 */
// const _generateStreamKey = (): string => {
//   return crypto.randomBytes(16).toString('hex');
// };
/**
 * Check the format of stream keys in the database
 */
async function checkStreamKeys() {
    var _a;
    try {
        // Get all rooms
        const rooms = await prisma.room.findMany();
        logger_1.logger.info(`Found ${rooms.length} rooms to check`);
        if (rooms.length === 0) {
            logger_1.logger.info('No rooms found in the database');
            return;
        }
        // Check each room's stream key
        for (const room of rooms) {
            logger_1.logger.info(`Room: ${room.id} (${room.name})`);
            logger_1.logger.info(`  Stream Key: ${room.streamKey || 'Not set'}`);
            logger_1.logger.info(`  Stream Key Length: ${((_a = room.streamKey) === null || _a === void 0 ? void 0 : _a.length) || 0} characters`);
            logger_1.logger.info(`  Valid Format: ${room.streamKey && room.streamKey.length >= 32 ? 'Yes' : 'No'}`);
            // Generate example URLs for this room
            const rtmpUrl = `rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app/${room.streamKey}`;
            const webrtcUrl = `wss://live.colourstream.johnrogerscolour.co.uk/app/${room.streamKey}?transport=tcp`;
            logger_1.logger.info(`  RTMP URL: ${rtmpUrl}`);
            logger_1.logger.info(`  WebRTC URL: ${webrtcUrl}`);
            logger_1.logger.info('-----------------------------------');
        }
        logger_1.logger.info('Stream key check completed');
    }
    catch (error) {
        logger_1.logger.error('Error checking stream keys:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the check
checkStreamKeys()
    .then(() => {
    logger_1.logger.info('Stream key check completed successfully');
    process.exit(0);
})
    .catch((error) => {
    logger_1.logger.error('Stream key check failed:', error);
    process.exit(1);
});
