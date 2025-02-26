import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Utility function to generate stream key
const generateStreamKey = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Utility function to generate a random password
const generatePassword = (): string => {
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
    
    logger.info(`Creating test room with stream key: ${streamKey}`);
    
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
    
    logger.info(`Test room created successfully with ID: ${room.id}`);
    logger.info(`Room password: ${password}`);
    logger.info(`Stream key: ${streamKey}`);
    logger.info(`Access URL: ${link}`);
    logger.info(`Presenter URL: ${room.presenterLink}`);
    logger.info(`OBS Stream URL: rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app/${streamKey}`);
    
    return room;
  } catch (error) {
    logger.error('Error creating test room:', error);
    throw error;
  } finally {
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