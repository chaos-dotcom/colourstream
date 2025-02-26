"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
class WebSocketService {
    constructor(server) {
        this.clients = new Set();
        this.wss = new ws_1.default.Server({
            server,
            path: '/api/ws',
            // Increase timeout values to prevent premature disconnections
            clientTracking: true,
        });
        logger_1.logger.info('WebSocket server initialized with path: /api/ws');
        this.setupWebSocketServer();
        this.pingInterval = this.startPingInterval();
    }
    setupWebSocketServer() {
        this.wss.on('connection', async (ws, request) => {
            // Extract token from query parameters
            const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
            const token = url.searchParams.get('token');
            const path = url.pathname;
            logger_1.logger.info(`WebSocket connection attempt to path: ${path}`, {
                url: request.url,
                headers: request.headers,
                remoteAddress: request.socket.remoteAddress,
                path,
                hasToken: !!token
            });
            try {
                if (!token) {
                    logger_1.logger.warn('WebSocket connection rejected: No token provided', {
                        path,
                        remoteAddress: request.socket.remoteAddress
                    });
                    ws.close(1008, 'No token provided');
                    return;
                }
                const decoded = await (0, auth_1.verifyToken)(token);
                ws.userId = decoded.userId;
                ws.type = decoded.type;
                ws.isAlive = true;
                // Only allow admin connections to the OBS status endpoint
                if (path.includes('/obs-status') && ws.type !== 'admin') {
                    logger_1.logger.warn(`WebSocket connection rejected: Unauthorized access to ${path} by ${ws.userId} (${ws.type})`, {
                        userId: ws.userId,
                        type: ws.type,
                        path
                    });
                    ws.close(1008, 'Unauthorized');
                    return;
                }
                this.clients.add(ws);
                logger_1.logger.info(`WebSocket client connected: ${ws.userId} (${ws.type}) to path ${path}`, {
                    userId: ws.userId,
                    type: ws.type,
                    path,
                    totalClients: this.clients.size
                });
                // Send initial status message for OBS connections
                if (path.includes('/obs-status') && ws.type === 'admin') {
                    // Import here to avoid circular dependency
                    const { obsService } = require('../index');
                    const status = obsService.getWebSocketStatus();
                    const statusMessage = JSON.stringify({
                        type: 'obs_status',
                        status: status.status,
                        ...(status.error && { error: status.error })
                    });
                    try {
                        ws.send(statusMessage);
                        logger_1.logger.info(`Sent initial OBS status to client ${ws.userId}: ${status.status}`, {
                            userId: ws.userId,
                            status: status.status,
                            error: status.error
                        });
                    }
                    catch (error) {
                        logger_1.logger.error(`Error sending initial status to client ${ws.userId}:`, error);
                    }
                }
                ws.on('pong', () => {
                    ws.isAlive = true;
                });
                ws.on('message', (message) => {
                    logger_1.logger.debug(`Received message from ${ws.userId}: ${message}`, {
                        userId: ws.userId,
                        messageLength: message.toString().length
                    });
                });
                ws.on('close', (code, reason) => {
                    this.clients.delete(ws);
                    logger_1.logger.info(`WebSocket client disconnected: ${ws.userId} with code ${code} and reason: ${reason || 'No reason provided'}`, {
                        userId: ws.userId,
                        code,
                        reason: reason || 'No reason provided',
                        remainingClients: this.clients.size
                    });
                });
                ws.on('error', (error) => {
                    logger_1.logger.error(`WebSocket error for client ${ws.userId}:`, {
                        userId: ws.userId,
                        error: error.message,
                        stack: error.stack
                    });
                    this.clients.delete(ws);
                });
            }
            catch (error) {
                logger_1.logger.error('WebSocket authentication error:', {
                    error,
                    path,
                    remoteAddress: request.socket.remoteAddress
                });
                ws.close(1008, 'Authentication failed');
            }
        });
        this.wss.on('error', (error) => {
            logger_1.logger.error('WebSocket server error:', {
                error: error.message,
                stack: error.stack
            });
        });
        this.wss.on('close', () => {
            logger_1.logger.info('WebSocket server closed');
        });
    }
    startPingInterval() {
        return setInterval(() => {
            this.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    logger_1.logger.debug(`Terminating inactive WebSocket client: ${ws.userId}`);
                    this.clients.delete(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }
    broadcastOBSStatus(status) {
        const message = JSON.stringify(status);
        let adminCount = 0;
        this.clients.forEach((client) => {
            if (client.type === 'admin' && client.readyState === ws_1.default.OPEN) {
                client.send(message);
                adminCount++;
            }
        });
        logger_1.logger.debug(`Broadcasted OBS status (${status.status}) to ${adminCount} admin clients`);
    }
    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        // Close all client connections
        this.clients.forEach((client) => {
            try {
                client.close(1000, 'Server shutting down');
            }
            catch (error) {
                logger_1.logger.error('Error closing WebSocket client:', error);
            }
        });
        this.wss.close();
        logger_1.logger.info('WebSocket service cleaned up');
    }
}
exports.default = WebSocketService;
