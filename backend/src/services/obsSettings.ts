import { PrismaClient } from '@prisma/client';
import { OBSSettings } from '../types/obs';

const prisma = new PrismaClient();

export async function getOBSSettings(): Promise<OBSSettings> {
  const settings = await prisma.obsSettings.findFirst();
  
  if (!settings) {
    // Return default settings if none exist
    return {
      host: 'localhost',
      port: 4455,
      enabled: false,
      streamType: 'rtmp_custom',
      protocol: 'rtmp',
      useLocalNetwork: true,
      localNetworkMode: 'frontend',
      localNetworkHost: 'localhost',
      localNetworkPort: 4455
    };
  }

  return {
    ...settings,
    password: settings.password || undefined // Only include password if it exists
  };
}

export async function updateOBSSettings(settings: OBSSettings): Promise<OBSSettings> {
  const existingSettings = await prisma.obsSettings.findFirst();

  if (existingSettings) {
    const updated = await prisma.obsSettings.update({
      where: { id: existingSettings.id },
      data: {
        host: settings.host,
        port: settings.port,
        password: settings.password || null,
        enabled: settings.enabled,
        streamType: settings.streamType,
        protocol: settings.protocol || 'rtmp',
        useLocalNetwork: settings.useLocalNetwork,
        localNetworkMode: settings.localNetworkMode,
        localNetworkHost: settings.localNetworkHost || null,
        localNetworkPort: settings.localNetworkPort || null,
        srtUrl: settings.srtUrl || null
      }
    });

    return {
      ...updated,
      password: updated.password || undefined
    };
  }

  const created = await prisma.obsSettings.create({
    data: {
      host: settings.host,
      port: settings.port,
      password: settings.password || null,
      enabled: settings.enabled,
      streamType: settings.streamType,
      protocol: settings.protocol || 'rtmp',
      useLocalNetwork: settings.useLocalNetwork,
      localNetworkMode: settings.localNetworkMode,
      localNetworkHost: settings.localNetworkHost || null,
      localNetworkPort: settings.localNetworkPort || null,
      srtUrl: settings.srtUrl || null
    }
  });

  return {
    ...created,
    password: created.password || undefined
  };
} 