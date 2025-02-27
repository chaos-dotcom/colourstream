import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export interface OBSSettings {
  id: string;
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';
  protocol: 'rtmp' | 'srt';
  srtUrl?: string;
}

export const getOBSSettings = async (): Promise<OBSSettings | null> => {
  try {
    const settings = await (prisma as any).obssettings.findUnique({
      where: { id: 'default' }
    });

    if (!settings) return null;

    // Convert null values to undefined and ensure correct types
    return {
      ...settings,
      streamType: 'rtmp_custom',
      password: settings.password || undefined,
      srtUrl: settings.srtUrl || undefined,
      protocol: (settings.protocol || 'rtmp') as 'rtmp' | 'srt',
      // Use host/port directly, ignoring legacy fields
      host: settings.host || settings.localNetworkHost || 'localhost',
      port: settings.port || settings.localNetworkPort || 4455
    } as OBSSettings;
  } catch (error) {
    logger.error('Error getting OBS settings:', error);
    throw error;
  }
};

export const updateOBSSettings = async (settings: Omit<OBSSettings, 'id'>): Promise<OBSSettings> => {
  try {
    const updatedSettings = await (prisma as any).obssettings.upsert({
      where: { id: 'default' },
      update: {
        ...settings,
        streamType: 'rtmp_custom',
        // For backward compatibility, update the legacy fields too
        useLocalNetwork: true,
        localNetworkMode: 'backend',
        localNetworkHost: settings.host,
        localNetworkPort: settings.port
      },
      create: {
        id: 'default',
        ...settings,
        streamType: 'rtmp_custom',
        useLocalNetwork: true,
        localNetworkMode: 'backend',
        localNetworkHost: settings.host,
        localNetworkPort: settings.port
      }
    });

    logger.info('Updated OBS settings:', updatedSettings);
    return {
      ...updatedSettings,
      streamType: 'rtmp_custom',
      password: updatedSettings.password || undefined,
      srtUrl: updatedSettings.srtUrl || undefined,
      protocol: (updatedSettings.protocol || 'rtmp') as 'rtmp' | 'srt'
    } as OBSSettings;
  } catch (error) {
    logger.error('Error updating OBS settings:', error);
    throw error;
  }
}; 