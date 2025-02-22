import OBSWebSocket from 'obs-websocket-js';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

class OBSService {
  private obs: OBSWebSocket;
  private isConnected: boolean = false;
  private rtmpServer: string;

  constructor() {
    this.obs = new OBSWebSocket();
    this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.johnrogerscolour.co.uk/live';
    logger.info(`Initialized OBS Service with RTMP server: ${this.rtmpServer}`);
    
    this.obs.on('ConnectionOpened', () => {
      logger.info('OBS WebSocket connected');
      this.isConnected = true;
    });

    this.obs.on('ConnectionClosed', () => {
      logger.info('OBS WebSocket disconnected');
      this.isConnected = false;
    });

    this.obs.on('ConnectionError', (error: Error) => {
      logger.error('OBS WebSocket error:', error);
    });
  }

  async connect(host: string, port: number, password?: string): Promise<void> {
    try {
      logger.info(`Attempting to connect to OBS at ws://${host}:${port}`);
      await this.obs.connect(`ws://${host}:${port}`, password);
      logger.info('Successfully connected to OBS WebSocket');
    } catch (err: any) {
      logger.error('Failed to connect to OBS:', err);
      throw new Error(`Failed to connect to OBS: ${err.message}`);
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
      logger.info('Attempting to set stream key in OBS');
      logger.info(`Using RTMP server: ${this.rtmpServer}`);
      await this.obs.call('SetStreamServiceSettings', {
        streamServiceType: 'rtmp_custom',
        streamServiceSettings: {
          server: this.rtmpServer,
          key: streamKey
        }
      });
      
      logger.info('Stream key updated successfully');
      
      // Start streaming after setting the stream key
      await this.startStream();
    } catch (err: any) {
      logger.error('Failed to set stream key:', err);
      throw new Error(`Failed to set stream key in OBS: ${err.message}`);
    }
  }

  async startStream(): Promise<void> {
    if (!this.isConnected) {
      logger.error('Cannot start stream: Not connected to OBS');
      throw new Error('Not connected to OBS');
    }

    try {
      logger.info('Starting OBS stream');
      await this.obs.call('StartStream');
      logger.info('Stream started successfully');
    } catch (err: any) {
      logger.error('Failed to start stream:', err);
      throw new Error(`Failed to start stream in OBS: ${err.message}`);
    }
  }

  async getSettings() {
    try {
      const settings = await prisma.obsSettings.findUnique({
        where: { id: 'default' }
      });
      logger.info('Retrieved OBS settings:', settings);
      return settings;
    } catch (err: any) {
      logger.error('Failed to get OBS settings:', err);
      throw err;
    }
  }

  async updateSettings(settings: {
    host: string;
    port: number;
    password?: string;
    enabled: boolean;
  }) {
    try {
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