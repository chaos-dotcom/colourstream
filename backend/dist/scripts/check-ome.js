"use strict";
const fetch = require('node-fetch');
// Test OvenMediaEngine API connection
async function testOmeApiConnection() {
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    try {
        console.log(`Testing connection to OvenMediaEngine API at ${apiUrl}`);
        const response = await fetch(`${apiUrl}/v1/stats`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        if (!response.ok) {
            console.error(`Failed to connect to OME API: ${response.status} ${response.statusText}`);
            return false;
        }
        const data = await response.json();
        console.log('Successfully connected to OvenMediaEngine API');
        console.log('API response:', JSON.stringify(data, null, 2));
        return data;
    }
    catch (error) {
        console.error('Error connecting to OvenMediaEngine API:', error);
        return false;
    }
}
// Check if a specific stream is active
async function checkStreamActive(streamKey) {
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    try {
        console.log(`Checking if stream with key ${streamKey} is active`);
        const response = await fetch(`${apiUrl}/v1/stats`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        if (!response.ok) {
            console.error(`Failed to connect to OME API: ${response.status} ${response.statusText}`);
            return false;
        }
        const data = await response.json();
        // Check if the stream exists in the stats
        let isActive = false;
        if (data && data.stats && data.stats.applications) {
            for (const app of data.stats.applications) {
                if (app.name === 'app' && app.streams) {
                    for (const stream of app.streams) {
                        if (stream.name === streamKey) {
                            isActive = true;
                            console.log(`Stream ${streamKey} is ACTIVE`);
                            console.log('Stream details:', JSON.stringify(stream, null, 2));
                            break;
                        }
                    }
                }
            }
        }
        if (!isActive) {
            console.log(`Stream ${streamKey} is NOT active`);
        }
        return isActive;
    }
    catch (error) {
        console.error('Error checking stream status:', error);
        return false;
    }
}
// Get all active streams
async function getActiveStreams() {
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    try {
        console.log('Getting all active streams');
        const response = await fetch(`${apiUrl}/v1/stats`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        if (!response.ok) {
            console.error(`Failed to connect to OME API: ${response.status} ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        const activeStreams = [];
        // Extract active stream keys
        if (data && data.stats && data.stats.applications) {
            for (const app of data.stats.applications) {
                if (app.name === 'app' && app.streams) {
                    for (const stream of app.streams) {
                        activeStreams.push({
                            name: stream.name,
                            sourceType: stream.source.type,
                            createdTime: stream.created_time,
                            streamInfo: stream.stream
                        });
                    }
                }
            }
        }
        console.log(`Found ${activeStreams.length} active streams`);
        if (activeStreams.length > 0) {
            console.log('Active streams:', JSON.stringify(activeStreams, null, 2));
        }
        return activeStreams;
    }
    catch (error) {
        console.error('Error getting active streams:', error);
        return [];
    }
}
// Check OvenMediaEngine configuration
async function checkOmeConfig() {
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    try {
        console.log('Checking OvenMediaEngine configuration');
        const response = await fetch(`${apiUrl}/v1/vhosts`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        if (!response.ok) {
            console.error(`Failed to get vhosts from OME API: ${response.status} ${response.statusText}`);
            return false;
        }
        const data = await response.json();
        console.log('OvenMediaEngine vhosts configuration:', JSON.stringify(data, null, 2));
        return data;
    }
    catch (error) {
        console.error('Error checking OvenMediaEngine configuration:', error);
        return false;
    }
}
// Run all tests
async function runTests() {
    try {
        // Test API connection
        const apiData = await testOmeApiConnection();
        if (!apiData) {
            console.error('OvenMediaEngine API connection test failed. Check your configuration.');
            return;
        }
        // Check OvenMediaEngine configuration
        await checkOmeConfig();
        // Get all active streams
        const activeStreams = await getActiveStreams();
        // Check a specific stream if provided as argument
        const streamKey = process.argv[2];
        if (streamKey) {
            await checkStreamActive(streamKey);
        }
        console.log('=== TEST RESULTS ===');
        console.log(`API Connection: ${apiData ? 'SUCCESS' : 'FAILED'}`);
        console.log(`Active Streams: ${activeStreams.length}`);
        console.log('===================');
    }
    catch (error) {
        console.error('Error running tests:', error);
    }
}
runTests()
    .then(() => {
    console.log('OvenMediaEngine check completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('OvenMediaEngine check failed:', error);
    process.exit(1);
});
