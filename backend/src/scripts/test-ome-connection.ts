import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Test script to verify OvenMediaEngine connectivity
 */
async function testOmeConnection() {
  const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
  const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
  
  logger.info('Testing OvenMediaEngine connection...');
  logger.info(`API URL: ${apiUrl}`);
  
  try {
    // Test API connectivity
    const statsResponse = await axios.get(`${apiUrl}/v1/stats`, {
      headers: {
        'Authorization': `Basic ${accessToken}`
      }
    });
    
    logger.info('OvenMediaEngine API connection successful');
    logger.info('Active streams:', statsResponse.data?.stats?.applications?.[0]?.streams || 'None');
    
    // Get available applications
    const configResponse = await axios.get(`${apiUrl}/v1/vhosts/default/apps`, {
      headers: {
        'Authorization': `Basic ${accessToken}`
      }
    });
    
    logger.info('Available applications:');
    if (configResponse.data?.response?.apps?.length > 0) {
      configResponse.data.response.apps.forEach((app: any) => {
        logger.info(`- ${app.name} (${app.type})`);
      });
    } else {
      logger.info('No applications found');
    }
    
    // Generate test URLs
    const appName = 'app'; // Default application name
    const testStreamKey = 'test-stream-key';
    
    logger.info('Connection URLs for testing:');
    logger.info(`RTMP: rtmp://live.colourstream.johnrogerscolour.co.uk:1935/${appName}/${testStreamKey}`);
    logger.info(`WebRTC (WSS): wss://live.colourstream.johnrogerscolour.co.uk/app/${testStreamKey}?transport=tcp`);
    logger.info(`SRT: srt://live.colourstream.johnrogerscolour.co.uk:9999?streamid=${appName}/${testStreamKey}`);
    
  } catch (error) {
    logger.error('Error connecting to OvenMediaEngine:', error);
  }
}

// Run the test
testOmeConnection()
  .then(() => {
    logger.info('OvenMediaEngine connection test completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('OvenMediaEngine connection test failed:', error);
    process.exit(1);
  }); 