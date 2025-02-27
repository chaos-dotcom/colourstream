import WebSocket from 'ws';
import { Server } from 'http';
import { verifyToken } from '../middleware/auth';
import { logger } from '../utils/logger';

interface WebSocketClient extends WebSocket {
  isAlive: boolean;
  userId?: string;
  type?: 'admin' | 'user';
  id?: string;
  isAdmin?: boolean;
}

interface OBSStatusMessage {
  type: 'obs_status';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  error?: string;
}

class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Set<WebSocketClient> = new Set();
  private pingInterval: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ 
      server,
      // Remove the path restriction to handle all paths
      // path: '/api/ws',
      // Increase timeout values to prevent premature disconnections
      clientTracking: true,
    });
    
    logger.info('WebSocket server initialized without path restriction to handle all WebSocket connections');
    this.setupWebSocketServer();
    this.pingInterval = this.startPingInterval();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: WebSocketClient, request) => {
      // Extract token from query parameters
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');
      const path = url.pathname;
      
      logger.info(`WebSocket connection attempt to path: ${path}`, {
        url: request.url,
        headers: request.headers,
        remoteAddress: request.socket.remoteAddress,
        path,
        hasToken: !!token
      });

      try {
        if (!token) {
          logger.warn('WebSocket connection rejected: No token provided', {
            path,
            remoteAddress: request.socket.remoteAddress
          });
          ws.close(1008, 'No token provided');
          return;
        }

        const decoded = await verifyToken(token);
        ws.userId = decoded.userId;
        ws.type = decoded.type;
        ws.isAlive = true;

        // Only allow admin connections to the OBS status endpoint
        if (path.includes('/api/ws/obs-status') && ws.type !== 'admin') {
          logger.warn(`WebSocket connection rejected: Unauthorized access to ${path} by ${ws.userId} (${ws.type})`, {
            userId: ws.userId,
            type: ws.type,
            path
          });
          ws.close(1008, 'Unauthorized');
          return;
        }

        this.clients.add(ws);
        logger.info(`WebSocket client connected: ${ws.userId} (${ws.type}) to path ${path}`, {
          userId: ws.userId,
          type: ws.type,
          path,
          totalClients: this.clients.size
        });

        // Send initial status message for OBS connections
        if (path.includes('/api/ws/obs-status') && ws.type === 'admin') {
          // Import here to avoid circular dependency
          const { obsService } = require('../index');
          const status = obsService.getWebSocketStatus();
          
          // Use the WebSocketService to send the initial status
          const websocketService = require('./websocketService').default;
          
          // Add a unique ID to the client for the WebSocketService
          ws.id = `${ws.userId}-${Date.now()}`;
          ws.isAdmin = ws.type === 'admin';
          
          // Add the client to the WebSocketService
          websocketService.addClient(ws);
          
          // Send the initial status
          websocketService.sendInitialOBSStatus(ws, status);
          
          logger.info(`Added client ${ws.id} to WebSocketService. Total clients: ${websocketService.getClientCount()}`);
        }

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('message', (message) => {
          logger.debug(`Received message from ${ws.userId}: ${message}`, {
            userId: ws.userId,
            messageLength: message.toString().length
          });
        });

        ws.on('close', (code, reason) => {
          this.clients.delete(ws);
          
          // Also remove from WebSocketService if it was added
          if (ws.id && path.includes('/api/ws/obs-status')) {
            const websocketService = require('./websocketService').default;
            websocketService.removeClient(ws.id);
          }
          
          logger.info(`WebSocket client disconnected: ${ws.userId} with code ${code} and reason: ${reason || 'No reason provided'}`, {
            userId: ws.userId,
            code,
            reason: reason || 'No reason provided',
            remainingClients: this.clients.size
          });
        });

        ws.on('error', (error) => {
          logger.error(`WebSocket error for client ${ws.userId}:`, {
            userId: ws.userId,
            error: error.message,
            stack: error.stack
          });
          this.clients.delete(ws);
        });

      } catch (error) {
        logger.error('WebSocket authentication error:', {
          error,
          path,
          remoteAddress: request.socket.remoteAddress
        });
        ws.close(1008, 'Authentication failed');
      }
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', {
        error: error.message,
        stack: error.stack
      });
    });

    this.wss.on('close', () => {
      logger.info('WebSocket server closed');
    });
  }

  private startPingInterval() {
    return setInterval(() => {
      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.debug(`Terminating inactive WebSocket client: ${ws.userId}`);
          this.clients.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  public broadcastOBSStatus(status: OBSStatusMessage) {
    const message = JSON.stringify(status);
    let adminCount = 0;
    
    this.clients.forEach((client) => {
      if (client.type === 'admin' && client.readyState === WebSocket.OPEN) {
        client.send(message);
        adminCount++;
      }
    });
    
    logger.debug(`Broadcasted OBS status (${status.status}) to ${adminCount} admin clients`);
  }

  public cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Close all client connections
    this.clients.forEach((client) => {
      try {
        client.close(1000, 'Server shutting down');
      } catch (error) {
        logger.error('Error closing WebSocket client:', error);
      }
    });
    
    this.wss.close();
    logger.info('WebSocket service cleaned up');
  }
}

export default WebSocketService; 