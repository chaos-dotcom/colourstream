import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Utility function to generate stream key
const generateStreamKey = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

async function verifyStreamKeys() {
  try {
    // Get all rooms
    const rooms = await prisma.room.findMany();
    
    logger.info(`Found ${rooms.length} rooms to check`);
    
    let updatedCount = 0;
    
    // Check each room's stream key
    for (const room of rooms) {
      // If stream key is missing or invalid, regenerate it
      if (!room.streamKey || room.streamKey.length < 32) {
        const newStreamKey = generateStreamKey();
        
        logger.info(`Updating stream key for room ${room.id} (${room.name})`);
        
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
    
    logger.info(`Stream key verification completed. Updated ${updatedCount} rooms.`);
  } catch (error) {
    logger.error('Error verifying stream keys:', error);
  } finally {
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