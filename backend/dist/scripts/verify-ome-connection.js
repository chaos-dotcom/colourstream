"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const node_fetch_1 = __importDefault(require("node-fetch"));
// Generate a test stream key
const generateStreamKey = () => {
    return crypto.randomBytes(16).toString('hex');
};
// Test OvenMediaEngine API connection
async function testOmeApiConnection() {
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    try {
        logger_1.logger.info(`Testing connection to OvenMediaEngine API at ${apiUrl}`);
        const response = await (0, node_fetch_1.default)(`${apiUrl}/v1/stats`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        if (!response.ok) {
            logger_1.logger.error(`Failed to connect to OME API: ${response.status} ${response.statusText}`);
            return false;
        }
        const data = await response.json();
        logger_1.logger.info('Successfully connected to OvenMediaEngine API');
        logger_1.logger.info('API response:', data);
        return true;
    }
    catch (error) {
        logger_1.logger.error('Error connecting to OvenMediaEngine API:', error);
        return false;
    }
}
// Test RTMP endpoint
async function testRtmpEndpoint() {
    const domain = process.env.DOMAIN || 'live.colourstream.johnrogerscolour.co.uk';
    const rtmpEndpoint = `rtmp://${domain}:1935/app`;
    const streamKey = generateStreamKey();
    logger_1.logger.info(`Testing RTMP endpoint: ${rtmpEndpoint}`);
    logger_1.logger.info(`Generated test stream key: ${streamKey}`);
    logger_1.logger.info(`Full RTMP URL for OBS: ${rtmpEndpoint}/${streamKey}`);
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
    logger_1.logger.info(`Testing WebRTC endpoint: ${webrtcEndpoint}`);
    logger_1.logger.info(`Generated test stream key: ${streamKey}`);
    logger_1.logger.info(`Full WebRTC URL for OvenPlayer: ${webrtcEndpoint}/${streamKey}`);
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
            logger_1.logger.error('OvenMediaEngine API connection test failed. Check your configuration.');
        }
        // Test RTMP endpoint
        const rtmpTest = await testRtmpEndpoint();
        logger_1.logger.info('RTMP endpoint information generated for testing');
        // Test WebRTC endpoint
        const webrtcTest = await testWebRtcEndpoint();
        logger_1.logger.info('WebRTC endpoint information generated for testing');
        // Output test results
        logger_1.logger.info('=== TEST RESULTS ===');
        logger_1.logger.info(`API Connection: ${apiConnected ? 'SUCCESS' : 'FAILED'}`);
        logger_1.logger.info(`RTMP Endpoint: ${rtmpTest.fullUrl}`);
        logger_1.logger.info(`WebRTC Endpoint: ${webrtcTest.fullUrl}`);
        logger_1.logger.info('===================');
        // Provide instructions for manual testing
        logger_1.logger.info('To test RTMP streaming:');
        logger_1.logger.info(`1. Configure OBS with the RTMP URL: ${rtmpTest.fullUrl}`);
        logger_1.logger.info('2. Start streaming in OBS');
        logger_1.logger.info('3. Check if the stream appears in the OvenMediaEngine API stats');
        logger_1.logger.info('To test WebRTC playback:');
        logger_1.logger.info(`1. Use OvenPlayer with the WebRTC URL: ${webrtcTest.fullUrl}`);
        logger_1.logger.info('2. Check if the player can connect and play the stream');
    }
    catch (error) {
        logger_1.logger.error('Error running tests:', error);
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
