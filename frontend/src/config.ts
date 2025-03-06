// Define the runtime configuration interface
interface RuntimeConfig {
  API_URL: string;
  OIDC_AUTH_ENDPOINT: string;
  WEBRTC_WS_HOST: string;
  WEBRTC_WS_PORT: string;
  WEBRTC_WS_PROTOCOL: string;
  WEBRTC_APP_PATH: string;
  VIDEO_URL: string;
  OVENPLAYER_SCRIPT_URL: string;
}

// Declare the global runtime config
declare global {
  interface Window {
    RUNTIME_CONFIG?: RuntimeConfig;
  }
}

// Function to get configuration values
// In production, it uses the runtime configuration injected by the container
// In development, it uses Vite's import.meta.env
const getConfig = (key: keyof RuntimeConfig): string => {
  // Check if running in browser and runtime config exists
  if (typeof window !== 'undefined' && window.RUNTIME_CONFIG) {
    const value = window.RUNTIME_CONFIG[key];
    if (value) return value;
  }

  // Fallback to import.meta.env (for development)
  const envKey = `VITE_${key}`;
  // @ts-ignore - dynamically accessing import.meta.env
  const envValue = import.meta.env[envKey];
  
  // Provide sensible defaults if no value is found
  switch (key) {
    case 'API_URL':
      return envValue || `${window.location.origin}/api`;
    case 'OIDC_AUTH_ENDPOINT':
      return envValue || `${window.location.origin}/authorize`;
    case 'WEBRTC_WS_HOST':
      return envValue || window.location.hostname;
    case 'WEBRTC_WS_PORT':
      return envValue || '3334';
    case 'WEBRTC_WS_PROTOCOL':
      return envValue || 'wss';
    case 'WEBRTC_APP_PATH':
      return envValue || 'app';
    case 'VIDEO_URL':
      return envValue || `${window.location.protocol}//${window.location.hostname}/join`;
    case 'OVENPLAYER_SCRIPT_URL':
      return envValue || 'https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.js';
    default:
      return envValue || '';
  }
};

// Export configuration values
export const API_URL = getConfig('API_URL');
export const OIDC_AUTH_ENDPOINT = getConfig('OIDC_AUTH_ENDPOINT');
export const WEBRTC_WS_HOST = getConfig('WEBRTC_WS_HOST');
export const WEBRTC_WS_PORT = getConfig('WEBRTC_WS_PORT');
export const WEBRTC_WS_PROTOCOL = getConfig('WEBRTC_WS_PROTOCOL');
export const WEBRTC_APP_PATH = getConfig('WEBRTC_APP_PATH');
export const VIDEO_URL = getConfig('VIDEO_URL');
export const OVENPLAYER_SCRIPT_URL = getConfig('OVENPLAYER_SCRIPT_URL');

// For debugging
if (typeof window !== 'undefined') {
  console.log('Config loaded:', {
    API_URL,
    OIDC_AUTH_ENDPOINT,
    WEBRTC_WS_HOST,
    WEBRTC_WS_PORT,
    WEBRTC_WS_PROTOCOL,
    WEBRTC_APP_PATH,
    VIDEO_URL,
    OVENPLAYER_SCRIPT_URL,
    source: window.RUNTIME_CONFIG ? 'runtime' : 'build-time'
  });
}

export default {
  API_URL,
  OIDC_AUTH_ENDPOINT,
  WEBRTC_WS_HOST,
  WEBRTC_WS_PORT,
  WEBRTC_WS_PROTOCOL,
  WEBRTC_APP_PATH,
  VIDEO_URL,
  OVENPLAYER_SCRIPT_URL
}; 