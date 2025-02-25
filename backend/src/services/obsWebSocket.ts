import OBSWebSocket from 'obs-websocket-js';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export type OBSConnectionStatus = {
  status: 'disconnected' | 'connected' | 'connecting' | 'error';
  error?: string;
};

class OBSWebSocketManager extends EventEmitter {
  private obs: OBSWebSocket;
  private status: OBSConnectionStatus;
  private reconnectTimer: NodeJS.Timeout | null;
  private heartbeatTimer: NodeJS.Timeout | null;
  private connectedClients: Set<WebSocket>;
  private static instance: OBSWebSocketManager;

  private constructor() {
    super();
    this.obs = new OBSWebSocket();
    this.status = { status: 'disconnected' };
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.connectedClients = new Set();

    // Set up event handlers
    this.obs.on('ConnectionOpened', this.handleConnectionOpened.bind(this));
    this.obs.on('ConnectionClosed', this.handleConnectionClosed.bind(this));
    this.obs.on('ConnectionError', this.handleConnectionError.bind(this));
    this.obs.on('Identified', this.handleIdentified.bind(this));
  }

  public static getInstance(): OBSWebSocketManager {
    if (!OBSWebSocketManager.instance) {
      OBSWebSocketManager.instance = new OBSWebSocketManager();
    }
    return OBSWebSocketManager.instance;
  }

  public getStatus(): OBSConnectionStatus {
    return this.status;
  }

  public addClient(ws: WebSocket): void {
    this.connectedClients.add(ws);
    // Send current status immediately to new client
    ws.send(JSON.stringify({ type: 'obs_status', ...this.status }));

    ws.on('close', () => {
      this.connectedClients.delete(ws);
    });
  }

  private broadcastStatus(): void {
    const message = JSON.stringify({ type: 'obs_status', ...this.status });
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private updateStatus(newStatus: OBSConnectionStatus): void {
    this.status = newStatus;
    this.broadcastStatus();
    this.emit('statusChanged', newStatus);
  }

  private handleConnectionOpened(): void {
    console.log('OBS WebSocket connection opened');
    this.updateStatus({ status: 'connecting' });
  }

  private handleConnectionClosed(): void {
    console.log('OBS WebSocket connection closed');
    this.updateStatus({ status: 'disconnected' });
    this.startReconnectTimer();
  }

  private handleConnectionError(error: Error): void {
    console.error('OBS WebSocket connection error:', error);
    this.updateStatus({ status: 'error', error: error.message });
    this.startReconnectTimer();
  }

  private handleIdentified(): void {
    console.log('OBS WebSocket identified successfully');
    this.updateStatus({ status: 'connected' });
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.obs.call('GetVersion');
      } catch (error) {
        console.error('OBS heartbeat failed:', error);
        this.handleConnectionError(error as Error);
      }
    }, 30000); // 30 second interval
  }

  private startReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000); // 5 second reconnect delay
  }

  public async connect(settings?: { host: string; port: number; password?: string }): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Disconnect if already connected
      try {
        await this.obs.disconnect();
      } catch (error) {
        // Ignore disconnect errors
      }

      this.updateStatus({ status: 'connecting' });

      if (settings) {
        const { host, port, password } = settings;
        await this.obs.connect(`ws://${host}:${port}`, password, {
          eventSubscriptions: 0xFFFFFFFF, // Subscribe to all events
          rpcVersion: 1
        });
      }
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
      this.handleConnectionError(error as Error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      await this.obs.disconnect();
      this.updateStatus({ status: 'disconnected' });
    } catch (error) {
      console.error('Error disconnecting from OBS:', error);
      this.handleConnectionError(error as Error);
    }
  }
}

export const obsWebSocketManager = OBSWebSocketManager.getInstance(); 