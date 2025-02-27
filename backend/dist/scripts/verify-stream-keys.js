"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
// Utility function to generate stream key
const generateStreamKey = () => {
    return crypto_1.default.randomBytes(16).toString('hex');
};
async function verifyStreamKeys() {
    try {
        // Get all rooms
        const rooms = await prisma.room.findMany();
        logger_1.logger.info(`Found ${rooms.length} rooms to check`);
        let updatedCount = 0;
        // Check each room's stream key
        for (const room of rooms) {
            // If stream key is missing or invalid, regenerate it
            if (!room.streamKey || room.streamKey.length < 32) {
                const newStreamKey = generateStreamKey();
                logger_1.logger.info(`Updating stream key for room ${room.id} (${room.name})`);
                await prisma.room.update({
                    where: {
                        id: room.id
                    },
                    data: {
                        streamKey: newStreamKey
                    }
                });
                updatedCount++;
            }
        }
        logger_1.logger.info(`Stream key verification completed. Updated ${updatedCount} rooms.`);
    }
    catch (error) {
        logger_1.logger.error('Error verifying stream keys:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
verifyStreamKeys()
    .then(() => {
    console.log('Stream key verification completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('Stream key verification failed:', error);
    process.exit(1);
});
