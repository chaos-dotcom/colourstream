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
  useLocalNetwork: boolean;
  localNetworkMode: 'frontend' | 'backend';
  localNetworkHost?: string;
  localNetworkPort?: number;
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
      localNetworkHost: settings.localNetworkHost || undefined,
      localNetworkPort: settings.localNetworkPort || undefined,
      srtUrl: settings.srtUrl || undefined,
      protocol: (settings.protocol || 'rtmp') as 'rtmp' | 'srt',
      localNetworkMode: (settings.localNetworkMode || 'frontend') as 'frontend' | 'backend'
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
        password: settings.password || null,
        localNetworkHost: settings.localNetworkHost || null,
        localNetworkPort: settings.localNetworkPort || null,
        srtUrl: settings.srtUrl || null
      },
      create: {
        ...settings,
        id: 'default',
        streamType: 'rtmp_custom',
        password: settings.password || null,
        localNetworkHost: settings.localNetworkHost || null,
        localNetworkPort: settings.localNetworkPort || null,
        srtUrl: settings.srtUrl || null
      }
    });

    // Convert null values to undefined in the return value
    return {
      ...updatedSettings,
      streamType: 'rtmp_custom',
      password: updatedSettings.password || undefined,
      localNetworkHost: updatedSettings.localNetworkHost || undefined,
      localNetworkPort: updatedSettings.localNetworkPort || undefined,
      srtUrl: updatedSettings.srtUrl || undefined,
      protocol: (updatedSettings.protocol || 'rtmp') as 'rtmp' | 'srt',
      localNetworkMode: (updatedSettings.localNetworkMode || 'frontend') as 'frontend' | 'backend'
    } as OBSSettings;
  } catch (error) {
    logger.error('Error updating OBS settings:', error);
    throw error;
  }
}; 