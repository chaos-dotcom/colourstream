"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const prisma = new client_1.PrismaClient();
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
            logger_1.logger.info('Creating default OBS settings');
            await prisma.obssettings.create({
                data: defaultSettings
            });
            logger_1.logger.info('Default OBS settings created successfully');
        }
        else {
            // Update existing settings
            logger_1.logger.info('Updating existing OBS settings');
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
            logger_1.logger.info('OBS settings updated successfully');
        }
        // Verify the settings
        const updatedSettings = await prisma.obssettings.findFirst();
        logger_1.logger.info('Current OBS settings:');
        logger_1.logger.info(`Stream Type: ${updatedSettings === null || updatedSettings === void 0 ? void 0 : updatedSettings.streamType}`);
        logger_1.logger.info(`Protocol: ${updatedSettings === null || updatedSettings === void 0 ? void 0 : updatedSettings.protocol}`);
        logger_1.logger.info(`Use Local Network: ${updatedSettings === null || updatedSettings === void 0 ? void 0 : updatedSettings.useLocalNetwork}`);
        logger_1.logger.info(`RTMP URL (stored in srtUrl): ${(updatedSettings === null || updatedSettings === void 0 ? void 0 : updatedSettings.srtUrl) || 'Not set'}`);
        // Provide instructions for OBS
        logger_1.logger.info('\nOBS Configuration Instructions:');
        logger_1.logger.info('1. In OBS, go to Settings > Stream');
        logger_1.logger.info('2. Select "Custom..." as the service');
        logger_1.logger.info(`3. Set Server to: ${rtmpUrl}`);
        logger_1.logger.info('4. Set Stream Key to your room\'s stream key');
        logger_1.logger.info('5. Click OK and start streaming');
    }
    catch (error) {
        logger_1.logger.error('Error updating OBS settings:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the update
updateObsSettings()
    .then(() => {
    logger_1.logger.info('OBS settings update completed');
    process.exit(0);
})
    .catch((error) => {
    logger_1.logger.error('OBS settings update failed:', error);
    process.exit(1);
});
