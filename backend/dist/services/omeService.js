"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OvenMediaEngineService = void 0;
const logger_1 = require("../utils/logger");
class OvenMediaEngineService {
    constructor() {
        // Get configuration from environment variables
        this.apiUrl = process.env.OME_API_URL || 'http://origin:8081';
        this.accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
        // Set streaming endpoints
        const domain = process.env.DOMAIN || 'live.colourstream.johnrogerscolour.co.uk';
        this.rtmpEndpoint = `rtmp://${domain}:1935/app`;
        this.srtEndpoint = `srt://${domain}:9999`;
        this.webrtcEndpoint = `wss://${domain}:3334/app`;
        this.srtLatency = parseInt(process.env.SRT_LATENCY || '2000000', 10);
        logger_1.logger.info(`Initialized OvenMediaEngine Service with URL: ${this.apiUrl}`);
        logger_1.logger.info(`Initialized service with OME RTMP endpoint: ${this.rtmpEndpoint}`);
        logger_1.logger.info(`Initialized service with OME WebRTC endpoint: ${this.webrtcEndpoint}`);
        logger_1.logger.info(`Initialized service with OME SRT endpoint: ${this.srtEndpoint}`);
        logger_1.logger.info(`Using SRT latency: ${this.srtLatency} microseconds`);
    }
    // Get streaming URL for OBS
    getStreamUrl(streamKey, protocol = 'rtmp') {
        if (protocol === 'rtmp') {
            return `${this.rtmpEndpoint}/${streamKey}`;
        }
        else if (protocol === 'webrtc') {
            return `${this.webrtcEndpoint}/${streamKey}`;
        }
        else {
            return `${this.srtEndpoint}?streamid=${streamKey}&latency=${this.srtLatency}`;
        }
    }
    // Check if a stream is active
    async isStreamActive(streamKey) {
        try {
            const response = await fetch(`${this.apiUrl}/v1/stats`, {
                headers: {
                    'Authorization': `Basic ${this.accessToken}`
                }
            });
            if (!response.ok) {
                logger_1.logger.error(`Failed to get stats from OME: ${response.status} ${response.statusText}`);
                return false;
            }
            const data = await response.json();
            // Check if the stream exists in the stats
            if (data && data.stats && data.stats.applications) {
                for (const app of data.stats.applications) {
                    if (app.name === 'app' && app.streams) {
                        for (const stream of app.streams) {
                            if (stream.name === streamKey) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }
        catch (error) {
            logger_1.logger.error('Error checking stream status:', error);
            return false;
        }
    }
    // Get all active streams
    async getActiveStreams() {
        try {
            const response = await fetch(`${this.apiUrl}/v1/stats`, {
                headers: {
                    'Authorization': `Basic ${this.accessToken}`
                }
            });
            if (!response.ok) {
                logger_1.logger.error(`Failed to get stats from OME: ${response.status} ${response.statusText}`);
                return [];
            }
            const data = await response.json();
            const activeStreams = [];
            // Extract active stream keys
            if (data && data.stats && data.stats.applications) {
                for (const app of data.stats.applications) {
                    if (app.name === 'app' && app.streams) {
                        for (const stream of app.streams) {
                            activeStreams.push(stream.name);
                        }
                    }
                }
            }
            return activeStreams;
        }
        catch (error) {
            logger_1.logger.error('Error getting active streams:', error);
            return [];
        }
    }
}
exports.OvenMediaEngineService = OvenMediaEngineService;
