import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Update OBS settings with the correct RTMP URL format
 */
async function updateObsSettings() {
  try {
    // Check if OBS settings exist
    const existingSettings = await prisma.obssettings.findFirst();
    
    // RTMP URL for OBS
    const rtmpUrl = 'rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app';
    
    // Default settings based on the actual schema
    const defaultSettings = {
      id: 'default',
      host: 'localhost',
      port: 4455,
      password: '',
      enabled: true,
      streamType: 'rtmp_custom',
      protocol: 'rtmp',
      useLocalNetwork: false,
      localNetworkMode: 'frontend',
      localNetworkHost: null,
      localNetworkPort: null,
      srtUrl: rtmpUrl // Store the RTMP URL in the srtUrl field as a workaround
    };
    
    if (!existingSettings) {
      // Create default settings if they don't exist
      logger.info('Creating default OBS settings');
      
      await prisma.obssettings.create({
        data: defaultSettings
      });
      
      logger.info('Default OBS settings created successfully');
    } else {
      // Update existing settings
      logger.info('Updating existing OBS settings');
      
      await prisma.obssettings.update({
        where: {
          id: existingSettings.id
        },
        data: {
          streamType: 'rtmp_custom',
          protocol: 'rtmp',
          useLocalNetwork: false, // Set to false to use public endpoints
          srtUrl: rtmpUrl // Store the RTMP URL in the srtUrl field as a workaround
        }
      });
      
      logger.info('OBS settings updated successfully');
    }
    
    // Verify the settings
    const updatedSettings = await prisma.obssettings.findFirst();
    
    logger.info('Current OBS settings:');
    logger.info(`Stream Type: ${updatedSettings?.streamType}`);
    logger.info(`Protocol: ${updatedSettings?.protocol}`);
    logger.info(`Use Local Network: ${updatedSettings?.useLocalNetwork}`);
    logger.info(`RTMP URL (stored in srtUrl): ${updatedSettings?.srtUrl || 'Not set'}`);
    
    // Provide instructions for OBS
    logger.info('\nOBS Configuration Instructions:');
    logger.info('1. In OBS, go to Settings > Stream');
    logger.info('2. Select "Custom..." as the service');
    logger.info(`3. Set Server to: ${rtmpUrl}`);
    logger.info('4. Set Stream Key to your room\'s stream key');
    logger.info('5. Click OK and start streaming');
    
  } catch (error) {
    logger.error('Error updating OBS settings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateObsSettings()
  .then(() => {
    logger.info('OBS settings update completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('OBS settings update failed:', error);
    process.exit(1);
  }); 