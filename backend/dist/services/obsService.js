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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.lastConnectionSettings = null;
        this.obs = new obs_websocket_js_1.default();
        this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.johnrogerscolour.co.uk/live';
        this.srtServer = process.env.SRT_SERVER_URL || 'srt://live.colourstream.johnrogerscolour.co.uk:9999';
        this.srtLatency = parseInt(process.env.SRT_LATENCY || '2000000', 10);
        logger_1.logger.info(`Initialized service with OME RTMP endpoint: ${this.rtmpServer}`);
        logger_1.logger.info(`Initialized service with OME SRT endpoint: ${this.srtServer}`);
        logger_1.logger.info(`Using SRT latency: ${this.srtLatency} microseconds`);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        // Internal events from obs-websocket-js
        this.obs.on('Hello', (data) => {
            logger_1.logger.info('Received Hello from OBS WebSocket server:', data);
        });
        this.obs.on('Identified', (data) => {
            logger_1.logger.info('Successfully identified with OBS WebSocket server:', data);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        });
        this.obs.on('ConnectionOpened', () => {
            logger_1.logger.info('OBS WebSocket connection opened');
        });
        this.obs.on('ConnectionClosed', () => {
            logger_1.logger.info('OBS WebSocket disconnected');
            this.isConnected = false;
            this.handleDisconnect();
        });
        this.obs.on('ConnectionError', (error) => {
            logger_1.logger.error('OBS WebSocket error:', error);
            this.isConnected = false;
            this.handleDisconnect();
        });
        // Add heartbeat check every 30 seconds
        setInterval(async () => {
            if (this.isConnected) {
                try {
                    await this.checkConnection();
                }
                catch (error) {
                    logger_1.logger.error('Heartbeat check failed:', error);
                    this.handleDisconnect();
                }
            }
        }, 30000);
    }
    async checkConnection() {
        try {
            // Try to get OBS version as a lightweight check
            const { obsVersion } = await this.obs.call('GetVersion');
            logger_1.logger.debug('OBS Version check successful:', obsVersion);
        }
        catch (error) {
            throw new Error('Connection check failed');
        }
    }
    async handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.lastConnectionSettings) {
            const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            logger_1.logger.info(`Attempting to reconnect in ${backoffTime}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.reconnectTimeout = setTimeout(async () => {
                this.reconnectAttempts++;
                try {
                    await this.connect(this.lastConnectionSettings.host, this.lastConnectionSettings.port, this.lastConnectionSettings.password);
                }
                catch (error) {
                    logger_1.logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
                }
            }, backoffTime);
        }
        else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max reconnection attempts reached');
        }
    }
    async connect(host, port, password) {
        var _a, _b;
        try {
            const settings = await this.getSettings();
            if (!(settings === null || settings === void 0 ? void 0 : settings.enabled)) {
                logger_1.logger.info('OBS integration is disabled, skipping connection');
                return;
            }
            // Use the settings from the database for OBS WebSocket connection
            host = settings.localNetworkHost || 'localhost';
            port = settings.localNetworkPort || 4455;
            // Only use password if it's actually set to something
            const authPassword = ((_a = settings.password) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
            // Store connection settings for reconnection
            this.lastConnectionSettings = {
                host,
                port,
                password: authPassword
            };
            const connectionUrl = `ws://${host}:${port}`;
            logger_1.logger.info(`Connecting to OBS WebSocket at ${connectionUrl}${authPassword ? ' with authentication' : ''}`);
            try {
                // Connect with proper identification
                await this.obs.connect(connectionUrl, authPassword, {
                    eventSubscriptions: 0xFFFFFFFF, // Subscribe to all events
                    rpcVersion: 1
                });
                logger_1.logger.info('Successfully connected to OBS WebSocket');
            }
            catch (error) {
                // Check if this is an auth error
                if (error.code === 4009) {
                    logger_1.logger.error('Authentication failed - incorrect password');
                    throw new Error('Authentication failed - incorrect password');
                }
                else if (error.code === 4008) {
                    logger_1.logger.error('Authentication required but no password provided');
                    throw new Error('Authentication required but no password provided');
                }
                throw error;
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to OBS:', {
                error: error.message,
                host,
                port,
                hasPassword: !!((_b = this.lastConnectionSettings) === null || _b === void 0 ? void 0 : _b.password),
                settings: await this.getSettings()
            });
            throw new Error(`Failed to connect to OBS: ${error.message}`);
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
            const settings = await this.getSettings();
            if (!settings) {
                throw new Error('OBS settings not found');
            }
            logger_1.logger.info('Attempting to set stream settings in OBS');
            // Always use rtmp_custom as the streamServiceType
            const streamServiceSettings = {
                streamServiceType: 'rtmp_custom',
                streamServiceSettings: {
                    server: '',
                    key: '',
                    use_auth: false
                }
            };
            if (settings.protocol === 'srt') {
                logger_1.logger.info('Using SRT protocol');
                const baseUrl = this.srtServer;
                const streamId = encodeURIComponent(`${this.srtServer}/app/${streamKey}`);
                const fullSrtUrl = `${baseUrl}?streamid=${streamId}&latency=${this.srtLatency}`;
                logger_1.logger.info(`Setting SRT URL to: ${fullSrtUrl}`);
                streamServiceSettings.streamServiceSettings.server = fullSrtUrl;
                streamServiceSettings.streamServiceSettings.key = '';
            }
            else {
                logger_1.logger.info('Using RTMP protocol');
                logger_1.logger.info(`Using RTMP server: ${this.rtmpServer}`);
                streamServiceSettings.streamServiceSettings.server = this.rtmpServer;
                streamServiceSettings.streamServiceSettings.key = streamKey;
            }
            try {
                await this.obs.call('SetStreamServiceSettings', streamServiceSettings);
                logger_1.logger.info('Stream settings updated successfully');
            }
            catch (obsError) {
                logger_1.logger.error('OBS Error Details:', {
                    error: obsError.message,
                    errorCode: obsError.code,
                    errorStack: obsError.stack,
                    requestedSettings: streamServiceSettings
                });
                throw obsError;
            }
            // Start streaming after setting the stream settings
            await this.startStream();
        }
        catch (err) {
            logger_1.logger.error('Failed to set stream settings:', {
                error: err.message,
                errorCode: err.code,
                errorStack: err.stack
            });
            throw new Error(`Failed to set stream settings in OBS: ${err.message}`);
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
    async testConnection(settings) {
        try {
            // Try to connect
            await this.connect(settings.host, settings.port, settings.password);
            // If we get here, connection was successful
            logger_1.logger.info('Test connection to OBS successful');
            // Always disconnect after test
            await this.disconnect();
        }
        catch (error) {
            logger_1.logger.error('Test connection to OBS failed:', {
                error: error.message,
                host: settings.host,
                port: settings.port
            });
            throw new Error(`Failed to connect to OBS: ${error.message}`);
        }
    }
    async updateSettings(settings) {
        try {
            // If backend mode and enabled, test the connection first
            if (settings.enabled && settings.localNetworkMode === 'backend') {
                await this.testConnection(settings);
            }
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
