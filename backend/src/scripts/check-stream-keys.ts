import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
// import * as crypto from 'crypto';

const prisma = new PrismaClient();

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
  try {
    // Get all rooms
    const rooms = await prisma.room.findMany();
    
    logger.info(`Found ${rooms.length} rooms to check`);
    
    if (rooms.length === 0) {
      logger.info('No rooms found in the database');
      return;
    }
    
    // Check each room's stream key
    for (const room of rooms) {
      logger.info(`Room: ${room.id} (${room.name})`);
      logger.info(`  Stream Key: ${room.streamKey || 'Not set'}`);
      logger.info(`  Stream Key Length: ${room.streamKey?.length || 0} characters`);
      logger.info(`  Valid Format: ${room.streamKey && room.streamKey.length >= 32 ? 'Yes' : 'No'}`);
      
      // Generate example URLs for this room
      const rtmpUrl = `rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app/${room.streamKey}`;
      const webrtcUrl = `wss://live.colourstream.johnrogerscolour.co.uk/app/${room.streamKey}?transport=tcp`;
      
      logger.info(`  RTMP URL: ${rtmpUrl}`);
      logger.info(`  WebRTC URL: ${webrtcUrl}`);
      logger.info('-----------------------------------');
    }
    
    logger.info('Stream key check completed');
  } catch (error) {
    logger.error('Error checking stream keys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkStreamKeys()
  .then(() => {
    logger.info('Stream key check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Stream key check failed:', error);
    process.exit(1);
  }); 