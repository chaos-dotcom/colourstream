export interface OBSSettings {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';
  useLocalNetwork: boolean;
  localNetworkMode: 'frontend' | 'backend';
  localNetworkHost?: string;
  localNetworkPort?: number;
  srtUrl?: string;
  protocol?: 'rtmp' | 'srt';
}

export interface OBSConnectionStatus {
  status: 'disconnected' | 'connected' | 'connecting' | 'error';
  error?: string;
} 