const axios = require('axios');

/**
 * Test script to verify OvenMediaEngine connectivity
 */
async function testOmeConnection() {
  const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
  const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
  
  console.log('Testing OvenMediaEngine connection...');
  console.log(`API URL: ${apiUrl}`);
  console.log(`Access Token: ${accessToken}`);
  
  try {
    // Test API connectivity with proper authentication
    // OvenMediaEngine requires the token to be base64 encoded
    const encodedToken = Buffer.from(`:${accessToken}`).toString('base64');
    
    const statsResponse = await axios.get(`${apiUrl}/v1/stats`, {
      headers: {
        'Authorization': `Basic ${encodedToken}`
      }
    });
    
    console.log('OvenMediaEngine API connection successful');
    console.log('Active streams:', statsResponse.data?.stats?.applications?.[0]?.streams || 'None');
    
    // Get available applications
    const configResponse = await axios.get(`${apiUrl}/v1/vhosts/default/apps`, {
      headers: {
        'Authorization': `Basic ${encodedToken}`
      }
    });
    
    console.log('Available applications:');
    if (configResponse.data?.response?.apps?.length > 0) {
      configResponse.data.response.apps.forEach((app) => {
        console.log(`- ${app.name} (${app.type})`);
      });
    } else {
      console.log('No applications found');
    }
    
    // Generate test URLs
    const appName = 'app'; // Default application name
    const testStreamKey = 'test-stream-key';
    
    console.log('Connection URLs for testing:');
    console.log(`RTMP: rtmp://live.colourstream.johnrogerscolour.co.uk:1935/${appName}/${testStreamKey}`);
    console.log(`WebRTC (WSS): wss://live.colourstream.johnrogerscolour.co.uk:3334/app/${testStreamKey}`);
    console.log(`SRT: srt://live.colourstream.johnrogerscolour.co.uk:9999?streamid=${appName}/${testStreamKey}`);
    
  } catch (error) {
    console.error('Error connecting to OvenMediaEngine:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testOmeConnection()
  .then(() => {
    console.log('OvenMediaEngine connection test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('OvenMediaEngine connection test failed:', error);
    process.exit(1);
  }); 