"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.obsService = void 0;
const obs_websocket_js_1 = __importDefault(require("obs-websocket-js"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const logger_1 = require("../utils/logger");
class OBSService {
    constructor() {
        this.isConnected = false;
        this.obs = new obs_websocket_js_1.default();
        this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.johnrogerscolour.co.uk/live';
        logger_1.logger.info(`Initialized OBS Service with RTMP server: ${this.rtmpServer}`);
        this.obs.on('ConnectionOpened', () => {
            logger_1.logger.info('OBS WebSocket connected');
            this.isConnected = true;
        });
        this.obs.on('ConnectionClosed', () => {
            logger_1.logger.info('OBS WebSocket disconnected');
            this.isConnected = false;
        });
        this.obs.on('ConnectionError', (error) => {
            logger_1.logger.error('OBS WebSocket error:', error);
        });
    }
    async connect(host, port, password) {
        try {
            logger_1.logger.info(`Attempting to connect to OBS at ws://${host}:${port}`);
            await this.obs.connect(`ws://${host}:${port}`, password);
            logger_1.logger.info('Successfully connected to OBS WebSocket');
        }
        catch (err) {
            logger_1.logger.error('Failed to connect to OBS:', err);
            throw new Error(`Failed to connect to OBS: ${err.message}`);
        }
    }
    async disconnect() {
        if (this.isConnected) {
            try {
                await this.obs.disconnect();
                logger_1.logger.info('Successfully disconnected from OBS WebSocket');
            }
            catch (err) {
                logger_1.logger.error('Error disconnecting from OBS:', err);
            }
        }
    }
    async setStreamKey(streamKey) {
        if (!this.isConnected) {
            logger_1.logger.error('Cannot set stream key: Not connected to OBS');
            throw new Error('Not connected to OBS');
        }
        try {
            logger_1.logger.info('Attempting to set stream key in OBS');
            logger_1.logger.info(`Using RTMP server: ${this.rtmpServer}`);
            await this.obs.call('SetStreamServiceSettings', {
                streamServiceType: 'rtmp_custom',
                streamServiceSettings: {
                    server: this.rtmpServer,
                    key: streamKey
                }
            });
            logger_1.logger.info('Stream key updated successfully');
            // Start streaming after setting the stream key
            await this.startStream();
        }
        catch (err) {
            logger_1.logger.error('Failed to set stream key:', err);
            throw new Error(`Failed to set stream key in OBS: ${err.message}`);
        }
    }
    async startStream() {
        if (!this.isConnected) {
            logger_1.logger.error('Cannot start stream: Not connected to OBS');
            throw new Error('Not connected to OBS');
        }
        try {
            logger_1.logger.info('Starting OBS stream');
            await this.obs.call('StartStream');
            logger_1.logger.info('Stream started successfully');
        }
        catch (err) {
            logger_1.logger.error('Failed to start stream:', err);
            throw new Error(`Failed to start stream in OBS: ${err.message}`);
        }
    }
    async getSettings() {
        try {
            const settings = await prisma_1.default.obsSettings.findUnique({
                where: { id: 'default' }
            });
            logger_1.logger.info('Retrieved OBS settings:', settings);
            return settings;
        }
        catch (err) {
            logger_1.logger.error('Failed to get OBS settings:', err);
            throw err;
        }
    }
    async updateSettings(settings) {
        try {
            const updatedSettings = await prisma_1.default.obsSettings.upsert({
                where: { id: 'default' },
                update: settings,
                create: {
                    ...settings,
                    id: 'default'
                }
            });
            logger_1.logger.info('Updated OBS settings:', updatedSettings);
            return updatedSettings;
        }
        catch (err) {
            logger_1.logger.error('Failed to update OBS settings:', err);
            throw err;
        }
    }
}
exports.obsService = new OBSService();
