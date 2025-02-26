const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

/**
 * Utility function to generate a stream key
 */
const generateStreamKey = () => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Check the format of stream keys in the database
 */
async function checkStreamKeys() {
  try {
    // Get all rooms
    const rooms = await prisma.room.findMany();
    
    console.log(`Found ${rooms.length} rooms to check`);
    
    if (rooms.length === 0) {
      console.log('No rooms found in the database');
      return;
    }
    
    // Check each room's stream key
    for (const room of rooms) {
      console.log(`Room: ${room.id} (${room.name})`);
      console.log(`  Stream Key: ${room.streamKey || 'Not set'}`);
      console.log(`  Stream Key Length: ${room.streamKey?.length || 0} characters`);
      console.log(`  Valid Format: ${room.streamKey && room.streamKey.length >= 32 ? 'Yes' : 'No'}`);
      
      // Generate example URLs for this room
      const rtmpUrl = `rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app/${room.streamKey}`;
      const webrtcUrl = `wss://live.colourstream.johnrogerscolour.co.uk:3334/app/${room.streamKey}`;
      
      console.log(`  RTMP URL: ${rtmpUrl}`);
      console.log(`  WebRTC URL: ${webrtcUrl}`);
      console.log('-----------------------------------');
    }
    
    console.log('Stream key check completed');
  } catch (error) {
    console.error('Error checking stream keys:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkStreamKeys()
  .then(() => {
    console.log('Stream key check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Stream key check failed:', error);
    process.exit(1);
  }); 