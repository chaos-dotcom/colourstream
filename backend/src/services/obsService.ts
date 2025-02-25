import OBSWebSocket from 'obs-websocket-js';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

interface OBSSettings {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';  // Always rtmp_custom for OBS
  protocol: 'rtmp' | 'srt';   // Internal protocol tracking
  srtUrl?: string;
  useLocalNetwork: boolean;
  localNetworkMode: 'frontend' | 'backend' | 'custom';
  localNetworkHost?: string;
  localNetworkPort?: number;
}

class OBSService {
  private obs: OBSWebSocket;
  private isConnected: boolean = false;
  private rtmpServer: string;
  private srtServer: string;
  private srtLatency: number;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastConnectionSettings: { host?: string; port?: number; password?: string } | null = null;

  constructor() {
    this.obs = new OBSWebSocket();
    this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.johnrogerscolour.co.uk/live';
    this.srtServer = process.env.SRT_SERVER_URL || 'srt://live.colourstream.johnrogerscolour.co.uk:9999';
    this.srtLatency = parseInt(process.env.SRT_LATENCY || '2000000', 10);
    
    logger.info(`Initialized service with OME RTMP endpoint: ${this.rtmpServer}`);
    logger.info(`Initialized service with OME SRT endpoint: ${this.srtServer}`);
    logger.info(`Using SRT latency: ${this.srtLatency} microseconds`);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Internal events from obs-websocket-js
    this.obs.on('Hello', (data) => {
      logger.info('Received Hello from OBS WebSocket server:', data);
    });

    this.obs.on('Identified', (data) => {
      logger.info('Successfully identified with OBS WebSocket server:', data);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    });

    this.obs.on('ConnectionOpened', () => {
      logger.info('OBS WebSocket connection opened');
    });

    this.obs.on('ConnectionClosed', () => {
      logger.info('OBS WebSocket disconnected');
      this.isConnected = false;
      this.handleDisconnect();
    });

    this.obs.on('ConnectionError', (error: Error) => {
      logger.error('OBS WebSocket error:', error);
      this.isConnected = false;
      this.handleDisconnect();
    });

    // Add heartbeat check every 30 seconds
    setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.checkConnection();
        } catch (error) {
          logger.error('Heartbeat check failed:', error);
          this.handleDisconnect();
        }
      }
    }, 30000);
  }

  private async checkConnection(): Promise<void> {
    try {
      // Try to get OBS version as a lightweight check
      const { obsVersion } = await this.obs.call('GetVersion');
      logger.debug('OBS Version check successful:', obsVersion);
    } catch (error) {
      throw new Error('Connection check failed');
    }
  }

  private async handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.lastConnectionSettings) {
      const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      logger.info(`Attempting to reconnect in ${backoffTime}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(async () => {
        this.reconnectAttempts++;
        try {
          await this.connect(
            this.lastConnectionSettings!.host,
            this.lastConnectionSettings!.port,
            this.lastConnectionSettings!.password
          );
        } catch (error) {
          logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        }
      }, backoffTime);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
    }
  }

  async connect(host?: string, port?: number, password?: string): Promise<void> {
    try {
      const settings = await this.getSettings();
      
      if (!settings?.enabled) {
        logger.info('OBS integration is disabled, skipping connection');
        return;
      }

      // Use the settings from the database for OBS WebSocket connection
      host = settings.localNetworkHost || 'localhost';
      port = settings.localNetworkPort || 4455;
      
      // Only use password if it's actually set to something
      const authPassword = settings.password?.trim() || undefined;

      // Store connection settings for reconnection
      this.lastConnectionSettings = { 
        host, 
        port, 
        password: authPassword 
      };

      const connectionUrl = `ws://${host}:${port}`;
      logger.info(`Connecting to OBS WebSocket at ${connectionUrl}${authPassword ? ' with authentication' : ''}`);
      
      try {
        // Connect with proper identification
        await this.obs.connect(connectionUrl, authPassword, {
          eventSubscriptions: 0xFFFFFFFF, // Subscribe to all events
          rpcVersion: 1
        });

        logger.info('Successfully connected to OBS WebSocket');
      } catch (error: any) {
        // Check if this is an auth error
        if (error.code === 4009) {
          logger.error('Authentication failed - incorrect password');
          throw new Error('Authentication failed - incorrect password');
        } else if (error.code === 4008) {
          logger.error('Authentication required but no password provided');
          throw new Error('Authentication required but no password provided');
        }
        throw error;
      }
    } catch (error: any) {
      logger.error('Failed to connect to OBS:', {
        error: error.message,
        host,
        port,
        hasPassword: !!this.lastConnectionSettings?.password,
        settings: await this.getSettings()
      });
      throw new Error(`Failed to connect to OBS: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.obs.disconnect();
        logger.info('Successfully disconnected from OBS WebSocket');
      } catch (err: any) {
        logger.error('Error disconnecting from OBS:', err);
      }
    }
  }

  async setStreamKey(streamKey: string): Promise<void> {
    if (!this.isConnected) {
      logger.error('Cannot set stream key: Not connected to OBS');
      throw new Error('Not connected to OBS');
    }

    try {
      const settings = await this.getSettings();
      if (!settings) {
        throw new Error('OBS settings not found');
      }

      logger.info('Attempting to set stream settings in OBS');
      
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
        logger.info('Using SRT protocol');
        const baseUrl = this.srtServer;
        const streamId = encodeURIComponent(`${this.srtServer}/app/${streamKey}`);
        const fullSrtUrl = `${baseUrl}?streamid=${streamId}&latency=${this.srtLatency}`;
        logger.info(`Setting SRT URL to: ${fullSrtUrl}`);
        
        streamServiceSettings.streamServiceSettings.server = fullSrtUrl;
        streamServiceSettings.streamServiceSettings.key = '';
      } else {
        logger.info('Using RTMP protocol');
        logger.info(`Using RTMP server: ${this.rtmpServer}`);
        streamServiceSettings.streamServiceSettings.server = this.rtmpServer;
        streamServiceSettings.streamServiceSettings.key = streamKey;
      }

      try {
        await this.obs.call('SetStreamServiceSettings', streamServiceSettings);
        logger.info('Stream settings updated successfully');
      } catch (obsError: any) {
        logger.error('OBS Error Details:', {
          error: obsError.message,
          errorCode: obsError.code,
          errorStack: obsError.stack,
          requestedSettings: streamServiceSettings
        });
        throw obsError;
      }
      
      // Start streaming after setting the stream settings
      await this.startStream();
    } catch (err: any) {
      logger.error('Failed to set stream settings:', {
        error: err.message,
        errorCode: err.code,
        errorStack: err.stack
      });
      throw new Error(`Failed to set stream settings in OBS: ${err.message}`);
    }
  }

  async startStream(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StartStream');
      logger.info('Stream started successfully');
    } catch (error: any) {
      logger.error('Failed to start stream:', error);
      throw new Error(`Failed to start stream: ${error.message}`);
    }
  }

  async stopStream(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to OBS');
    }

    try {
      await this.obs.call('StopStream');
      logger.info('Stream stopped successfully');
    } catch (error: any) {
      logger.error('Failed to stop stream:', error);
      throw new Error(`Failed to stop stream: ${error.message}`);
    }
  }

  async getSettings(): Promise<OBSSettings | null> {
    try {
      const settings = await prisma.obsSettings.findUnique({
        where: { id: 'default' }
      });
      logger.info('Retrieved OBS settings:', settings);
      return settings as OBSSettings | null;
    } catch (err: any) {
      logger.error('Failed to get OBS settings:', err);
      throw err;
    }
  }

  async testConnection(settings: OBSSettings): Promise<void> {
    try {
      // Try to connect
      await this.connect(settings.host, settings.port, settings.password);
      
      // If we get here, connection was successful
      logger.info('Test connection to OBS successful');
      
      // Always disconnect after test
      await this.disconnect();
    } catch (error: any) {
      logger.error('Test connection to OBS failed:', {
        error: error.message,
        host: settings.host,
        port: settings.port
      });
      throw new Error(`Failed to connect to OBS: ${error.message}`);
    }
  }

  async updateSettings(settings: OBSSettings) {
    try {
      // If backend mode and enabled, test the connection first
      if (settings.enabled && settings.localNetworkMode === 'backend') {
        await this.testConnection(settings);
      }

      const updatedSettings = await prisma.obsSettings.upsert({
        where: { id: 'default' },
        update: settings,
        create: {
          ...settings,
          id: 'default'
        }
      });
      logger.info('Updated OBS settings:', updatedSettings);
      return updatedSettings;
    } catch (err: any) {
      logger.error('Failed to update OBS settings:', err);
      throw err;
    }
  }
}

export const obsService = new OBSService(); 