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
  localNetworkHost: string;
  localNetworkPort: number;
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
      // Ensure all required properties exist
      useLocalNetwork: settings.useLocalNetwork ?? true,
      localNetworkMode: (settings.localNetworkMode || 'frontend') as 'frontend' | 'backend',
      localNetworkHost: settings.localNetworkHost || 'localhost',
      localNetworkPort: settings.localNetworkPort || 4455
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
        // Make sure to update all fields
        useLocalNetwork: settings.useLocalNetwork ?? true,
        localNetworkMode: settings.localNetworkMode || 'frontend',
        localNetworkHost: settings.localNetworkHost || settings.host || 'localhost',
        localNetworkPort: settings.localNetworkPort || settings.port || 4455,
        updatedAt: new Date()
      },
      create: {
        id: 'default',
        ...settings,
        streamType: 'rtmp_custom',
        useLocalNetwork: settings.useLocalNetwork ?? true,
        localNetworkMode: settings.localNetworkMode || 'frontend',
        localNetworkHost: settings.localNetworkHost || settings.host || 'localhost',
        localNetworkPort: settings.localNetworkPort || settings.port || 4455,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    logger.info('Updated OBS settings:', updatedSettings);
    return {
      ...updatedSettings,
      streamType: 'rtmp_custom',
      password: updatedSettings.password || undefined,
      srtUrl: updatedSettings.srtUrl || undefined,
      protocol: (updatedSettings.protocol || 'rtmp') as 'rtmp' | 'srt',
      useLocalNetwork: updatedSettings.useLocalNetwork ?? true,
      localNetworkMode: (updatedSettings.localNetworkMode || 'frontend') as 'frontend' | 'backend',
      localNetworkHost: updatedSettings.localNetworkHost || 'localhost',
      localNetworkPort: updatedSettings.localNetworkPort || 4455
    } as OBSSettings;
  } catch (error) {
    logger.error('Error updating OBS settings:', error);
    throw error;
  }
}; 