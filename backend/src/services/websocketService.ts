import WebSocket from 'ws';
import { logger } from '../utils/logger';

// Define the WebSocketClient interface
interface WebSocketClient extends WebSocket {
  id: string;
  isAdmin: boolean;
  userId?: string;
}

// Define the OBS status message interface
interface OBSStatusMessage {
  type: 'obs_status';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  error?: string;
  timestamp?: string;
}

class WebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();

  public broadcastOBSStatus(status: OBSStatusMessage): void {
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
    logger.info(`Broadcasting OBS status: ${status.status}`, { 
      statusDetails: statusWithTimestamp 
    });
    
    // Send to all admin clients
    let adminCount = 0;
    this.clients.forEach((client) => {
      if (client.isAdmin && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(statusWithTimestamp));
          adminCount++;
        } catch (error) {
          logger.error('Error sending OBS status to client:', error);
        }
      }
    });
    
    if (adminCount > 0) {
      logger.debug(`Sent OBS status to ${adminCount} admin clients`);
    }
  }

  public sendInitialOBSStatus(client: WebSocketClient, status: { status: string; error: string | null }): void {
    if (!client.isAdmin) {
      return;
    }
    
    try {
      const statusMessage: OBSStatusMessage = {
        type: 'obs_status',
        status: status.status as 'connected' | 'disconnected' | 'connecting' | 'error',
        error: status.error || undefined,
        timestamp: new Date().toISOString()
      };
      
      client.send(JSON.stringify(statusMessage));
      logger.info(`Sent initial OBS status to client ${client.id}: ${status.status}`);
    } catch (error) {
      logger.error('Error sending initial OBS status:', error);
    }
  }

  // Method to add a client
  public addClient(client: WebSocketClient): void {
    this.clients.set(client.id, client);
    logger.debug(`Client ${client.id} added. Total clients: ${this.clients.size}`);
  }

  // Method to remove a client
  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.debug(`Client ${clientId} removed. Total clients: ${this.clients.size}`);
  }
  
  // Get client count
  public getClientCount(): number {
    return this.clients.size;
  }
  
  // Get admin client count
  public getAdminClientCount(): number {
    let count = 0;
    this.clients.forEach(client => {
      if (client.isAdmin) count++;
    });
    return count;
  }
}

export default new WebSocketService(); 