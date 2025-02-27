"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
// Utility function to generate stream key
const generateStreamKey = () => {
    return crypto.randomBytes(16).toString('hex');
};
// Utility function to generate a random password
const generatePassword = () => {
    return Math.random().toString(36).substring(2, 10);
};
async function createTestRoom() {
    try {
        // Generate a unique stream key
        const streamKey = generateStreamKey();
        const password = generatePassword();
        const displayPassword = password; // For display purposes
        const mirotalkRoomId = `test-room-${Date.now()}`;
        const link = `https://app.colourstream.johnrogerscolour.co.uk/room/${mirotalkRoomId}`;
        logger_1.logger.info(`Creating test room with stream key: ${streamKey}`);
        // Create a test room
        const room = await prisma.room.create({
            data: {
                name: 'Test Room',
                mirotalkRoomId: mirotalkRoomId,
                streamKey: streamKey,
                password: password,
                displayPassword: displayPassword,
                expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                link: link,
                presenterLink: `${link}?access=p`,
                mirotalkToken: '',
                createdAt: new Date()
            }
        });
        logger_1.logger.info(`Test room created successfully with ID: ${room.id}`);
        logger_1.logger.info(`Room password: ${password}`);
        logger_1.logger.info(`Stream key: ${streamKey}`);
        logger_1.logger.info(`Access URL: ${link}`);
        logger_1.logger.info(`Presenter URL: ${room.presenterLink}`);
        logger_1.logger.info(`OBS Stream URL: rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app/${streamKey}`);
        return room;
    }
    catch (error) {
        logger_1.logger.error('Error creating test room:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
createTestRoom()
    .then((room) => {
    console.log('Test room created successfully');
    console.log(JSON.stringify(room, null, 2));
    process.exit(0);
})
    .catch((error) => {
    console.error('Failed to create test room:', error);
    process.exit(1);
});
