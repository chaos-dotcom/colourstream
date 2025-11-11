import OBSWebSocket from 'obs-websocket-js';
import { logger } from '../utils/logger';
// import { ObsSettings, getObsSettings } from '../models/obsSettings';
// import { StreamStats } from '../types/obs';
import prisma from '../lib/prisma';
import { OBSWebSocketService } from './obsWebSocket';

// Updated interface for OBS v5
interface OBSSettings {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';  // Always rtmp_custom for OBS
  protocol: 'rtmp' | 'srt';   // Internal protocol tracking
  srtUrl?: string;
  useLocalNetwork: boolean;
  localNetworkMode: 'frontend' | 'backend';
  localNetworkHost: string;
  localNetworkPort: number;
}

class OBSService {
  private obsWebSocket: OBSWebSocketService;
  private obs: OBSWebSocket;
  private rtmpServer: string;
  private srtServer: string;
  private srtLatency: number;

  constructor(wsService: any) { // Use any type to avoid circular reference issues
    this.obsWebSocket = new OBSWebSocketService(wsService);
    this.obs = this.obsWebSocket.getObs(); // Get the OBSWebSocket instance
    this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.colourstream.colourbyrogers.co.uk:1935/app';
    this.srtServer = process.env.SRT_SERVER_URL || 'srt://live.colourstream.colourbyrogers.co.uk:9999';
    this.srtLatency = parseInt(process.env.SRT_LATENCY || '2000000', 10);
    
    logger.info(`Initialized service with OME RTMP endpoint: ${this.rtmpServer}`);
    logger.info(`Initialized service with OME SRT endpoint: ${this.srtServer}`);
    logger.info(`Using SRT latency: ${this.srtLatency} microseconds`);
  }

  public async connectToOBS(settings: OBSSettings): Promise<void> {
    try {
      if (!settings.enabled) {
        logger.info('OBS integration is disabled, skipping connection');
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

      // Connect to OBS using the OBSWebSocketService
      logger.info(`Connecting to OBS WebSocket at ws://${host}:${port} with authentication: ${password ? 'yes' : 'no'}`);
      await this.obsWebSocket.connect({ host, port, password });
      
    } catch (error) {
      logger.error('Failed to connect to OBS:', {
        error: error instanceof Error ? error.message : String(error),
        settings: {
          host: settings.host,
          port: settings.port,
          protocol: settings.protocol,
        }
      });
      
      throw new Error(`Failed to connect to OBS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnectFromOBS(): Promise<void> {
    try {
      await this.obsWebSocket.disconnect();
      logger.info('Successfully disconnected from OBS WebSocket');
    } catch (err: any) {
      logger.error('Error disconnecting from OBS:', err);
    }
  }

  async setStreamKey(streamKey: string): Promise<void> {
    if (this.obsWebSocket.getStatus().status !== 'connected') {
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
    if (this.obsWebSocket.getStatus().status !== 'connected') {
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
    if (this.obsWebSocket.getStatus().status !== 'connected') {
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
      // Ensure prisma is properly initialized
      if (!prisma) {
        logger.error('Prisma client is not initialized');
        throw new Error('Prisma client is not initialized');
      }
      
      // Check if obssettings model exists in prisma
      if (!(prisma as any).obssettings) {
        logger.error('obssettings model is not available in Prisma client');
        throw new Error('obssettings model is not available in Prisma client');
      }
      
      const settings = await (prisma as any).obssettings.findUnique({
        where: { id: 'default' }
      });
      
      logger.info('Retrieved OBS settings:', settings);
      
      if (!settings) {
        // If no settings exist, create default settings
        logger.info('No OBS settings found, creating default settings');
        return this.createDefaultSettings();
      }
      
      return settings as OBSSettings;
    } catch (err: any) {
      logger.error('Failed to get OBS settings:', err);
      // Return default settings if there's an error
      return this.createDefaultSettings();
    }
  }
  
  private async createDefaultSettings(): Promise<OBSSettings> {
    try {
      const defaultSettings = {
        id: 'default',
        host: 'localhost',
        port: 4455,
        enabled: false,
        streamType: 'rtmp_custom' as const,
        protocol: 'rtmp' as const,
        useLocalNetwork: true,
        localNetworkMode: 'frontend' as const,
        localNetworkHost: 'localhost',
        localNetworkPort: 4455,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Try to create default settings
      if (prisma && (prisma as any).obssettings) {
        const created = await (prisma as any).obssettings.upsert({
          where: { id: 'default' },
          update: defaultSettings,
          create: defaultSettings
        });
        
        logger.info('Created default OBS settings:', created);
        return created as OBSSettings;
      }
      
      // If prisma is not available, return the default settings object
      return defaultSettings as OBSSettings;
    } catch (err: any) {
      logger.error('Failed to create default OBS settings:', err);
      // Return a basic settings object if we can't create it in the database
      return {
        host: 'localhost',
        port: 4455,
        enabled: false,
        streamType: 'rtmp_custom' as const,
        protocol: 'rtmp' as const,
        useLocalNetwork: true,
        localNetworkMode: 'frontend' as const,
        localNetworkHost: 'localhost',
        localNetworkPort: 4455
      };
    }
  }

  public async testConnection(settings: OBSSettings): Promise<void> {
    try {
      // Try to connect
      await this.connectToOBS(settings);
      
      // If we get here, connection was successful
      logger.info('Test connection to OBS successful');
      
      // Always disconnect after test
      await this.disconnectFromOBS();
    } catch (error: any) {
      logger.error('Test connection to OBS failed:', {
        error: error.message,
        host: settings.host,
        port: settings.port
      });
      throw new Error(`Test connection to OBS failed: ${error.message}`);
    }
  }

  public async updateSettings(settings: OBSSettings): Promise<OBSSettings> {
    try {
      // If backend mode and enabled, test the connection first
      if (settings.enabled && settings.localNetworkMode === 'backend') {
        try {
          await this.testConnection(settings);
        } catch (error: any) {
          // Log the error but continue with saving settings
          logger.warn('OBS connection test failed, but continuing with settings update:', error.message);
          // We'll still save the settings, but we'll return a warning
        }
      }

      // Ensure prisma is properly initialized
      if (!prisma || !(prisma as any).obssettings) {
        logger.error('Prisma client or obssettings model is not available');
        throw new Error('Database error: Cannot update OBS settings');
      }

      const updatedSettings = await (prisma as any).obssettings.upsert({
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
      
      logger.info('Updated OBS settings:', updatedSettings);
      return updatedSettings;
    } catch (err: any) {
      logger.error('Failed to update OBS settings:', err);
      throw err;
    }
  }

  public getWebSocketStatus() {
    return this.obsWebSocket.getStatus();
  }

  public cleanup() {
    this.obsWebSocket.cleanup();
  }
}

// Export the class as default to match the import in services/index.ts
export default OBSService; 
