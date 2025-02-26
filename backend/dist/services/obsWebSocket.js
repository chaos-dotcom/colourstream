"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSWebSocketService = void 0;
const obs_websocket_js_1 = __importDefault(require("obs-websocket-js"));
const logger_1 = require("../utils/logger");
class OBSWebSocketService {
    constructor(wsService) {
        this.connectionStatus = 'disconnected';
        this.lastError = null;
        this.reconnectTimeout = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // 5 seconds
        this.connectionCheckInterval = null;
        this.obs = new obs_websocket_js_1.default();
        this.wsService = wsService;
        this.setupEventHandlers();
        logger_1.logger.info('OBS WebSocket service initialized');
    }
    setupEventHandlers() {
        this.obs.on('ConnectionOpened', () => {
            logger_1.logger.info('OBS WebSocket connection opened');
            this.updateStatus('connecting');
        });
        this.obs.on('Hello', (data) => {
            logger_1.logger.info('Received Hello from OBS WebSocket server:', data);
        });
        this.obs.on('Identified', () => {
            logger_1.logger.info('Successfully connected and identified with OBS');
            this.connectionStatus = 'connected';
            this.lastError = null;
            this.reconnectAttempts = 0;
            this.broadcastStatus();
            this.startConnectionCheck();
        });
        this.obs.on('ConnectionClosed', () => {
            logger_1.logger.warn('OBS WebSocket connection closed');
            this.connectionStatus = 'disconnected';
            this.broadcastStatus();
            this.stopConnectionCheck();
            this.attemptReconnect();
        });
        this.obs.on('ConnectionError', (err) => {
            logger_1.logger.error('OBS WebSocket connection error:', err);
            this.connectionStatus = 'error';
            this.lastError = err.message;
            this.broadcastStatus();
            this.stopConnectionCheck();
            this.attemptReconnect();
        });
    }
    broadcastStatus() {
        this.wsService.broadcastOBSStatus({
            type: 'obs_status',
            status: this.connectionStatus,
            ...(this.lastError && { error: this.lastError })
        });
        logger_1.logger.debug(`Broadcasting OBS status: ${this.connectionStatus}${this.lastError ? ` (Error: ${this.lastError})` : ''}`);
    }
    startConnectionCheck() {
        // Stop any existing interval
        this.stopConnectionCheck();
        // Start a new interval to periodically check the connection
        this.connectionCheckInterval = setInterval(async () => {
            if (this.connectionStatus === 'connected') {
                try {
                    const { obsVersion } = await this.obs.call('GetVersion');
                    logger_1.logger.debug(`OBS connection check successful - OBS version: ${obsVersion}`);
                }
                catch (error) {
                    logger_1.logger.error('OBS connection check failed:', error);
                    this.connectionStatus = 'error';
                    this.lastError = 'Connection check failed';
                    this.broadcastStatus();
                    this.stopConnectionCheck();
                    this.attemptReconnect();
                }
            }
        }, 30000); // Check every 30 seconds
        logger_1.logger.debug('Started OBS connection check interval');
    }
    stopConnectionCheck() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
            logger_1.logger.debug('Stopped OBS connection check interval');
        }
    }
    attemptReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max reconnection attempts reached');
            return;
        }
        const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 60000);
        this.reconnectAttempts++;
        logger_1.logger.info(`Scheduling OBS reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(() => {
            logger_1.logger.info(`Attempting to reconnect to OBS (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.connect().catch(error => {
                logger_1.logger.error('Reconnection attempt failed:', error);
            });
        }, delay);
    }
    async connect(settings) {
        try {
            if (settings) {
                const { host, port, password } = settings;
                const url = `ws://${host}:${port}`;
                logger_1.logger.info(`Connecting to OBS at ${url}${password ? ' with authentication' : ''}`);
                this.updateStatus('connecting');
                try {
                    await this.obs.connect(url, password, {
                        eventSubscriptions: 0xFFFFFFFF, // Subscribe to all events
                        rpcVersion: 1
                    });
                    logger_1.logger.info('Successfully connected to OBS');
                    this.updateStatus('connected');
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
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to OBS:', error);
            this.lastError = error.message;
            this.updateStatus('error');
            throw error;
        }
    }
    updateStatus(status) {
        this.connectionStatus = status;
        this.broadcastStatus();
    }
    getStatus() {
        return {
            status: this.connectionStatus,
            ...(this.lastError && { error: this.lastError })
        };
    }
    async disconnect() {
        try {
            this.stopConnectionCheck();
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
            if (this.obs) {
                logger_1.logger.info('Disconnecting from OBS WebSocket');
                await this.obs.disconnect();
                this.updateStatus('disconnected');
            }
        }
        catch (error) {
            logger_1.logger.error('Error disconnecting from OBS:', error);
        }
    }
    getObs() {
        return this.obs;
    }
    cleanup() {
        this.stopConnectionCheck();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.disconnect();
        logger_1.logger.info('OBS WebSocket service cleaned up');
    }
}
exports.OBSWebSocketService = OBSWebSocketService;
exports.default = OBSWebSocketService;
