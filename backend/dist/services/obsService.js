"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSService = void 0;
const logger_1 = require("../utils/logger");
// import { ObsSettings, getObsSettings } from '../models/obsSettings';
// import { StreamStats } from '../types/obs';
const prisma_1 = __importDefault(require("../lib/prisma"));
const obsWebSocket_1 = require("./obsWebSocket");
class OBSService {
    constructor(wsService) {
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimeout = null;
        this.lastConnectionSettings = null;
        this.wsService = wsService;
        this.obsWebSocket = new obsWebSocket_1.OBSWebSocketService(wsService);
        this.obs = this.obsWebSocket.getObs(); // Get the OBSWebSocket instance
        this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.colourstream.johnrogerscolour.co.uk:1935/app';
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
            // Broadcast connected status
            this.wsService.broadcastOBSStatus({
                type: 'obs_status',
                status: 'connected'
            });
        });
        this.obs.on('ConnectionOpened', () => {
            logger_1.logger.info('OBS WebSocket connection opened');
        });
        this.obs.on('ConnectionClosed', () => {
            logger_1.logger.info('OBS WebSocket disconnected');
            this.isConnected = false;
            // Broadcast disconnected status
            this.wsService.broadcastOBSStatus({
                type: 'obs_status',
                status: 'disconnected'
            });
            this.handleDisconnect();
        });
        this.obs.on('ConnectionError', (error) => {
            logger_1.logger.error('OBS WebSocket error:', error);
            this.isConnected = false;
            // Broadcast error status
            this.wsService.broadcastOBSStatus({
                type: 'obs_status',
                status: 'error',
                error: error.message
            });
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
    handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.lastConnectionSettings) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            logger_1.logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
            this.reconnectTimeout = setTimeout(async () => {
                this.reconnectAttempts++;
                try {
                    await this.connectToOBS(this.lastConnectionSettings);
                }
                catch (error) {
                    logger_1.logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
                    this.handleDisconnect();
                }
            }, delay);
        }
        else {
            logger_1.logger.warn(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached or no connection settings available`);
        }
    }
    async connectToOBS(settings) {
        try {
            if (!settings.enabled) {
                logger_1.logger.info('OBS integration is disabled, skipping connection');
                return;
            }
            // Use direct host/port from settings
            const host = settings.host;
            const port = settings.port;
            const password = settings.password;
            // Validate required fields
            if (!host) {
                throw new Error('OBS host is required');
            }
            if (!port || port <= 0) {
                throw new Error('Valid OBS port is required');
            }
            // Check if we're already connected with the same settings
            if (this.isConnected &&
                this.lastConnectionSettings &&
                this.lastConnectionSettings.host === host &&
                this.lastConnectionSettings.port === port &&
                this.lastConnectionSettings.password === password) {
                logger_1.logger.info('Already connected to OBS with the same settings, skipping reconnection');
                return;
            }
            // Disconnect if already connected
            if (this.isConnected) {
                await this.disconnectFromOBS();
            }
            // Store the connection settings
            this.lastConnectionSettings = {
                host,
                port,
                password,
                enabled: settings.enabled,
                streamType: 'rtmp_custom',
                protocol: settings.protocol || 'rtmp',
                useLocalNetwork: settings.useLocalNetwork,
                localNetworkMode: settings.localNetworkMode,
                localNetworkHost: settings.localNetworkHost,
                localNetworkPort: settings.localNetworkPort
            };
            // Connect to OBS
            const wsUrl = `ws://${host}:${port}`;
            logger_1.logger.info(`Connecting to OBS WebSocket at ${wsUrl} with authentication: ${password ? 'yes' : 'no'}`);
            const connectOptions = {};
            if (password) {
                connectOptions.password = password;
            }
            await this.obs.connect(wsUrl, connectOptions);
            this.isConnected = true;
            logger_1.logger.info('Successfully connected to OBS');
            // Broadcast the connected status
            this.wsService.broadcastOBSStatus({
                type: 'obs_status',
                status: 'connected'
            });
        }
        catch (error) {
            this.isConnected = false;
            logger_1.logger.error('Failed to connect to OBS:', {
                error: error instanceof Error ? error.message : String(error),
                settings: {
                    host: settings.host,
                    port: settings.port,
                    protocol: settings.protocol,
                }
            });
            // Broadcast the error status
            this.wsService.broadcastOBSStatus({
                type: 'obs_status',
                status: 'error',
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`Failed to connect to OBS: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async disconnectFromOBS() {
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
            throw new Error('Not connected to OBS');
        }
        try {
            await this.obs.call('StartStream');
            logger_1.logger.info('Stream started successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to start stream:', error);
            throw new Error(`Failed to start stream: ${error.message}`);
        }
    }
    async stopStream() {
        if (!this.isConnected) {
            throw new Error('Not connected to OBS');
        }
        try {
            await this.obs.call('StopStream');
            logger_1.logger.info('Stream stopped successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to stop stream:', error);
            throw new Error(`Failed to stop stream: ${error.message}`);
        }
    }
    async getSettings() {
        try {
            // Ensure prisma is properly initialized
            if (!prisma_1.default) {
                logger_1.logger.error('Prisma client is not initialized');
                throw new Error('Prisma client is not initialized');
            }
            // Check if obssettings model exists in prisma
            if (!prisma_1.default.obssettings) {
                logger_1.logger.error('obssettings model is not available in Prisma client');
                throw new Error('obssettings model is not available in Prisma client');
            }
            const settings = await prisma_1.default.obssettings.findUnique({
                where: { id: 'default' }
            });
            logger_1.logger.info('Retrieved OBS settings:', settings);
            if (!settings) {
                // If no settings exist, create default settings
                logger_1.logger.info('No OBS settings found, creating default settings');
                return this.createDefaultSettings();
            }
            return settings;
        }
        catch (err) {
            logger_1.logger.error('Failed to get OBS settings:', err);
            // Return default settings if there's an error
            return this.createDefaultSettings();
        }
    }
    async createDefaultSettings() {
        try {
            const defaultSettings = {
                id: 'default',
                host: 'localhost',
                port: 4455,
                enabled: false,
                streamType: 'rtmp_custom',
                protocol: 'rtmp',
                useLocalNetwork: true,
                localNetworkMode: 'frontend',
                localNetworkHost: 'localhost',
                localNetworkPort: 4455,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // Try to create default settings
            if (prisma_1.default && prisma_1.default.obssettings) {
                const created = await prisma_1.default.obssettings.upsert({
                    where: { id: 'default' },
                    update: defaultSettings,
                    create: defaultSettings
                });
                logger_1.logger.info('Created default OBS settings:', created);
                return created;
            }
            // If prisma is not available, return the default settings object
            return defaultSettings;
        }
        catch (err) {
            logger_1.logger.error('Failed to create default OBS settings:', err);
            // Return a basic settings object if we can't create it in the database
            return {
                host: 'localhost',
                port: 4455,
                enabled: false,
                streamType: 'rtmp_custom',
                protocol: 'rtmp',
                useLocalNetwork: true,
                localNetworkMode: 'frontend',
                localNetworkHost: 'localhost',
                localNetworkPort: 4455
            };
        }
    }
    async testConnection(settings) {
        try {
            // Try to connect
            await this.connectToOBS(settings);
            // If we get here, connection was successful
            logger_1.logger.info('Test connection to OBS successful');
            // Always disconnect after test
            await this.disconnectFromOBS();
        }
        catch (error) {
            logger_1.logger.error('Test connection to OBS failed:', {
                error: error.message,
                host: settings.host,
                port: settings.port
            });
            throw new Error(`Test connection to OBS failed: ${error.message}`);
        }
    }
    async updateSettings(settings) {
        try {
            // If backend mode and enabled, test the connection first
            if (settings.enabled && settings.localNetworkMode === 'backend') {
                try {
                    await this.testConnection(settings);
                }
                catch (error) {
                    // Log the error but continue with saving settings
                    logger_1.logger.warn('OBS connection test failed, but continuing with settings update:', error.message);
                    // We'll still save the settings, but we'll return a warning
                }
            }
            // Ensure prisma is properly initialized
            if (!prisma_1.default || !prisma_1.default.obssettings) {
                logger_1.logger.error('Prisma client or obssettings model is not available');
                throw new Error('Database error: Cannot update OBS settings');
            }
            const updatedSettings = await prisma_1.default.obssettings.upsert({
                where: { id: 'default' },
                update: {
                    ...settings,
                    updatedAt: new Date() // Ensure updatedAt is set
                },
                create: {
                    ...settings,
                    id: 'default',
                    createdAt: new Date(),
                    updatedAt: new Date()
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
    getWebSocketStatus() {
        return {
            status: this.isConnected ? 'connected' : 'disconnected',
            error: this.isConnected ? null : 'Not connected to OBS'
        };
    }
    cleanup() {
        this.obsWebSocket.cleanup();
    }
}
exports.OBSService = OBSService;
// Export the class as default to match the import in services/index.ts
exports.default = OBSService;
