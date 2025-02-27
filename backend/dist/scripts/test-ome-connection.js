"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
/**
 * Test script to verify OvenMediaEngine connectivity
 */
async function testOmeConnection() {
    var _a, _b, _c, _d, _e, _f, _g;
    const apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    const accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    logger_1.logger.info('Testing OvenMediaEngine connection...');
    logger_1.logger.info(`API URL: ${apiUrl}`);
    try {
        // Test API connectivity
        const statsResponse = await axios_1.default.get(`${apiUrl}/v1/stats`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        logger_1.logger.info('OvenMediaEngine API connection successful');
        logger_1.logger.info('Active streams:', ((_d = (_c = (_b = (_a = statsResponse.data) === null || _a === void 0 ? void 0 : _a.stats) === null || _b === void 0 ? void 0 : _b.applications) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.streams) || 'None');
        // Get available applications
        const configResponse = await axios_1.default.get(`${apiUrl}/v1/vhosts/default/apps`, {
            headers: {
                'Authorization': `Basic ${accessToken}`
            }
        });
        logger_1.logger.info('Available applications:');
        if (((_g = (_f = (_e = configResponse.data) === null || _e === void 0 ? void 0 : _e.response) === null || _f === void 0 ? void 0 : _f.apps) === null || _g === void 0 ? void 0 : _g.length) > 0) {
            configResponse.data.response.apps.forEach((app) => {
                logger_1.logger.info(`- ${app.name} (${app.type})`);
            });
        }
        else {
            logger_1.logger.info('No applications found');
        }
        // Generate test URLs
        const appName = 'app'; // Default application name
        const testStreamKey = 'test-stream-key';
        logger_1.logger.info('Connection URLs for testing:');
        logger_1.logger.info(`RTMP: rtmp://live.colourstream.johnrogerscolour.co.uk:1935/${appName}/${testStreamKey}`);
        logger_1.logger.info(`WebRTC (WSS): wss://live.colourstream.johnrogerscolour.co.uk/app/${testStreamKey}?transport=tcp`);
        logger_1.logger.info(`SRT: srt://live.colourstream.johnrogerscolour.co.uk:9999?streamid=${appName}/${testStreamKey}`);
    }
    catch (error) {
        logger_1.logger.error('Error connecting to OvenMediaEngine:', error);
    }
}
// Run the test
testOmeConnection()
    .then(() => {
    logger_1.logger.info('OvenMediaEngine connection test completed');
    process.exit(0);
})
    .catch((error) => {
    logger_1.logger.error('OvenMediaEngine connection test failed:', error);
    process.exit(1);
});
