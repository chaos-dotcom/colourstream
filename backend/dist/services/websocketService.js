"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../utils/logger");
class WebSocketService {
    constructor() {
        this.clients = new Map();
    }
    broadcastOBSStatus(status) {
        // Only broadcast if we have clients
        if (this.clients.size === 0) {
            return;
        }
        // Add timestamp to the status
        const statusWithTimestamp = {
            ...status,
            timestamp: new Date().toISOString()
        };
        // Log once per status change, not for every client
        logger_1.logger.info(`Broadcasting OBS status: ${status.status}`, {
            statusDetails: statusWithTimestamp
        });
        // Send to all admin clients
        let adminCount = 0;
        this.clients.forEach((client) => {
            if (client.isAdmin && client.readyState === ws_1.default.OPEN) {
                try {
                    client.send(JSON.stringify(statusWithTimestamp));
                    adminCount++;
                }
                catch (error) {
                    logger_1.logger.error('Error sending OBS status to client:', error);
                }
            }
        });
        if (adminCount > 0) {
            logger_1.logger.debug(`Sent OBS status to ${adminCount} admin clients`);
        }
    }
    sendInitialOBSStatus(client, status) {
        if (!client.isAdmin) {
            return;
        }
        try {
            const statusMessage = {
                type: 'obs_status',
                status: status.status,
                error: status.error || undefined,
                timestamp: new Date().toISOString()
            };
            client.send(JSON.stringify(statusMessage));
            logger_1.logger.info(`Sent initial OBS status to client ${client.id}: ${status.status}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending initial OBS status:', error);
        }
    }
    // Method to add a client
    addClient(client) {
        this.clients.set(client.id, client);
        logger_1.logger.debug(`Client ${client.id} added. Total clients: ${this.clients.size}`);
    }
    // Method to remove a client
    removeClient(clientId) {
        this.clients.delete(clientId);
        logger_1.logger.debug(`Client ${clientId} removed. Total clients: ${this.clients.size}`);
    }
    // Get client count
    getClientCount() {
        return this.clients.size;
    }
    // Get admin client count
    getAdminClientCount() {
        let count = 0;
        this.clients.forEach(client => {
            if (client.isAdmin)
                count++;
        });
        return count;
    }
}
exports.default = new WebSocketService();
