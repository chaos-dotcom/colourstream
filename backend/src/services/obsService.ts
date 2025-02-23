import OBSWebSocket from 'obs-websocket-js';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

interface OBSSettings {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp' | 'srt';
  srtUrl?: string;
}

class OBSService {
  private obs: OBSWebSocket;
  private isConnected: boolean = false;
  private rtmpServer: string;
  private srtServer: string;

  constructor() {
    this.obs = new OBSWebSocket();
    this.rtmpServer = process.env.RTMP_SERVER_URL || 'rtmp://live.johnrogerscolour.co.uk/live';
    this.srtServer = process.env.SRT_SERVER_URL || 'srt://live.colourstream.johnrogerscolour.co.uk:9999?streamid=srt://live.colourstream.johnrogerscolour.co.uk:9999/app';
    logger.info(`Initialized OBS Service with RTMP server: ${this.rtmpServer}`);
    logger.info(`Initialized OBS Service with SRT server: ${this.srtServer}`);
    
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
      const settings = await this.getSettings();
      if (!settings) {
        throw new Error('OBS settings not found');
      }

      logger.info('Attempting to set stream settings in OBS');
      
      if (settings.streamType === 'srt') {
        logger.info('Using SRT protocol');
        const baseUrl = `srt://live.colourstream.johnrogerscolour.co.uk:9999`;
        const streamId = encodeURIComponent(`srt://live.colourstream.johnrogerscolour.co.uk:9999/app/${streamKey}`);
        const fullSrtUrl = `${baseUrl}?streamid=${streamId}&latency=2000000`;
        logger.info(`Setting SRT URL to: ${fullSrtUrl}`);
        
        try {
          await this.obs.call('SetStreamServiceSettings', {
            streamServiceType: 'custom_streaming',
            streamServiceSettings: {
              server: fullSrtUrl,
              key: '',
              use_auth: false
            }
          });
        } catch (obsError: any) {
          logger.error('OBS Error Details:', {
            error: obsError.message,
            errorCode: obsError.code,
            errorStack: obsError.stack,
            requestedSettings: {
              streamServiceType: 'custom_streaming',
              streamServiceSettings: {
                server: fullSrtUrl,
                key: '',
                use_auth: false
              }
            }
          });
          throw obsError;
        }
      } else {
        logger.info('Using RTMP protocol');
        logger.info(`Using RTMP server: ${this.rtmpServer}`);
        await this.obs.call('SetStreamServiceSettings', {
          streamServiceType: 'rtmp_custom',
          streamServiceSettings: {
            server: this.rtmpServer,
            key: streamKey
          }
        });
      }
      
      logger.info('Stream settings updated successfully');
      
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

  async updateSettings(settings: OBSSettings) {
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