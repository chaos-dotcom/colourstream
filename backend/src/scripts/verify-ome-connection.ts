import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

// Generate a test stream key
const generateStreamKey = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Test OvenMediaEngine API connection
async function testOmeApiConnection() {
  const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
  const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
  
  try {
    logger.info(`Testing connection to OvenMediaEngine API at ${apiUrl}`);
    
    const response = await fetch(`${apiUrl}/v1/stats`, {
      headers: {
        'Authorization': `Basic ${accessToken}`
      }
    });
    
    if (!response.ok) {
      logger.error(`Failed to connect to OME API: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    logger.info('Successfully connected to OvenMediaEngine API');
    logger.info('API response:', data);
    
    return true;
  } catch (error) {
    logger.error('Error connecting to OvenMediaEngine API:', error);
    return false;
  }
}

// Test RTMP endpoint
async function testRtmpEndpoint() {
  const domain = process.env.DOMAIN || 'live.colourstream.johnrogerscolour.co.uk';
  const rtmpEndpoint = `rtmp://${domain}:1935/app`;
  const streamKey = generateStreamKey();
  
  logger.info(`Testing RTMP endpoint: ${rtmpEndpoint}`);
  logger.info(`Generated test stream key: ${streamKey}`);
  logger.info(`Full RTMP URL for OBS: ${rtmpEndpoint}/${streamKey}`);
  
  // We can't actually test RTMP connection programmatically here,
  // but we can provide the information for manual testing
  
  return {
    rtmpEndpoint,
    streamKey,
    fullUrl: `${rtmpEndpoint}/${streamKey}`
  };
}

// Test WebRTC endpoint
async function testWebRtcEndpoint() {
  const domain = process.env.DOMAIN || 'live.colourstream.johnrogerscolour.co.uk';
  const webrtcEndpoint = `wss://${domain}/app`;
  const streamKey = generateStreamKey();
  
  logger.info(`Testing WebRTC endpoint: ${webrtcEndpoint}`);
  logger.info(`Generated test stream key: ${streamKey}`);
  logger.info(`Full WebRTC URL for OvenPlayer: ${webrtcEndpoint}/${streamKey}`);
  
  // We can't actually test WebRTC connection programmatically here,
  // but we can provide the information for manual testing
  
  return {
    webrtcEndpoint,
    streamKey,
    fullUrl: `${webrtcEndpoint}/${streamKey}`
  };
}

async function runTests() {
  try {
    // Test API connection
    const apiConnected = await testOmeApiConnection();
    
    if (!apiConnected) {
      logger.error('OvenMediaEngine API connection test failed. Check your configuration.');
    }
    
    // Test RTMP endpoint
    const rtmpTest = await testRtmpEndpoint();
    logger.info('RTMP endpoint information generated for testing');
    
    // Test WebRTC endpoint
    const webrtcTest = await testWebRtcEndpoint();
    logger.info('WebRTC endpoint information generated for testing');
    
    // Output test results
    logger.info('=== TEST RESULTS ===');
    logger.info(`API Connection: ${apiConnected ? 'SUCCESS' : 'FAILED'}`);
    logger.info(`RTMP Endpoint: ${rtmpTest.fullUrl}`);
    logger.info(`WebRTC Endpoint: ${webrtcTest.fullUrl}`);
    logger.info('===================');
    
    // Provide instructions for manual testing
    logger.info('To test RTMP streaming:');
    logger.info(`1. Configure OBS with the RTMP URL: ${rtmpTest.fullUrl}`);
    logger.info('2. Start streaming in OBS');
    logger.info('3. Check if the stream appears in the OvenMediaEngine API stats');
    
    logger.info('To test WebRTC playback:');
    logger.info(`1. Use OvenPlayer with the WebRTC URL: ${webrtcTest.fullUrl}`);
    logger.info('2. Check if the player can connect and play the stream');
    
  } catch (error) {
    logger.error('Error running tests:', error);
  }
}

runTests()
  .then(() => {
    console.log('Verification script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification script failed:', error);
    process.exit(1);
  }); 