import { logger } from '../utils/logger';

export class OvenMediaEngineService {
  private apiUrl: string;
  private accessToken: string;
  private rtmpEndpoint: string;
  private srtEndpoint: string;
  private webrtcEndpoint: string;
  private srtLatency: number;

  constructor() {
    // Get configuration from environment variables
    this.apiUrl = process.env.OME_API_URL || 'http://origin:8081';
    this.accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
    
    // Set streaming endpoints
    const domain = process.env.DOMAIN || 'live.colourstream.johnrogerscolour.co.uk';
    this.rtmpEndpoint = `rtmp://${domain}:1935/app`;
    this.srtEndpoint = `srt://${domain}:9999`;
    this.webrtcEndpoint = `wss://${domain}:3334/app`;
    this.srtLatency = parseInt(process.env.SRT_LATENCY || '2000000', 10);
    
    logger.info(`Initialized OvenMediaEngine Service with URL: ${this.apiUrl}`);
    logger.info(`Initialized service with OME RTMP endpoint: ${this.rtmpEndpoint}`);
    logger.info(`Initialized service with OME WebRTC endpoint: ${this.webrtcEndpoint}`);
    logger.info(`Initialized service with OME SRT endpoint: ${this.srtEndpoint}`);
    logger.info(`Using SRT latency: ${this.srtLatency} microseconds`);
  }

  // Get streaming URL for OBS
  public getStreamUrl(streamKey: string, protocol: 'rtmp' | 'srt' | 'webrtc' = 'rtmp'): string {
    if (protocol === 'rtmp') {
      return `${this.rtmpEndpoint}/${streamKey}`;
    } else if (protocol === 'webrtc') {
      return `${this.webrtcEndpoint}/${streamKey}`;
    } else {
      return `${this.srtEndpoint}?streamid=${streamKey}&latency=${this.srtLatency}`;
    }
  }

  // Check if a stream is active
  public async isStreamActive(streamKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/stats`, {
        headers: {
          'Authorization': `Basic ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        logger.error(`Failed to get stats from OME: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const data = await response.json();
      
      // Check if the stream exists in the stats
      if (data && data.stats && data.stats.applications) {
        for (const app of data.stats.applications) {
          if (app.name === 'app' && app.streams) {
            for (const stream of app.streams) {
              if (stream.name === streamKey) {
                return true;
              }
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking stream status:', error);
      return false;
    }
  }

  // Get all active streams
  public async getActiveStreams(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/stats`, {
        headers: {
          'Authorization': `Basic ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        logger.error(`Failed to get stats from OME: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      const activeStreams: string[] = [];
      
      // Extract active stream keys
      if (data && data.stats && data.stats.applications) {
        for (const app of data.stats.applications) {
          if (app.name === 'app' && app.streams) {
            for (const stream of app.streams) {
              activeStreams.push(stream.name);
            }
          }
        }
      }
      
      return activeStreams;
    } catch (error) {
      logger.error('Error getting active streams:', error);
      return [];
    }
  }
} 