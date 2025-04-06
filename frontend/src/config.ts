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
  UPLOAD_ENDPOINT_URL: string;
  NAMEFORUPLOADCOMPLETION: string;
  // S3 configuration
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  // Companion configuration
  COMPANION_URL: string; // URL for Companion (used by Dropbox, Google Drive, etc.)
  // COMPANION_AWS_ENDPOINT: string; // Removed - Not used by @uppy/aws-s3 with backend signing
  USE_COMPANION: string; // Still relevant for providers like Dropbox/Google Drive
  // Provider configuration
  ENABLE_DROPBOX: string;
  ENABLE_GOOGLE_DRIVE: string;
  GOOGLE_DRIVE_CLIENT_ID: string;
  GOOGLE_DRIVE_API_KEY: string;
  GOOGLE_DRIVE_APP_ID: string;
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
    case 'UPLOAD_ENDPOINT_URL':
      return envValue || 'https://upload.colourstream.johnrogerscolour.co.uk/';
    case 'NAMEFORUPLOADCOMPLETION':
      return envValue || 'John';
    // S3 configuration defaults
    case 'S3_ENDPOINT':
      return envValue || 'https://s3.colourstream.johnrogerscolour.co.uk';
    case 'S3_REGION':
      return envValue || 'us-east-1';
    case 'S3_BUCKET':
      return envValue || 'uploads';
    // Companion configuration defaults
    case 'COMPANION_URL':
      // Use VITE_COMPANION_URL from env if available, otherwise default based on current domain
      return envValue || `https://companion.${window.location.hostname.replace(/^[^.]+\./, '')}`;
    // Removed case for 'COMPANION_AWS_ENDPOINT' as it's no longer in RuntimeConfig
    case 'USE_COMPANION':
      return envValue || 'true';
    // Provider configuration defaults
    case 'ENABLE_DROPBOX':
      return envValue || 'false';
    case 'ENABLE_GOOGLE_DRIVE':
      return envValue || 'false';
    case 'GOOGLE_DRIVE_CLIENT_ID':
      return envValue || '';
    case 'GOOGLE_DRIVE_API_KEY':
      return envValue || '';
    case 'GOOGLE_DRIVE_APP_ID':
      return envValue || '';
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
export const UPLOAD_ENDPOINT_URL = getConfig('UPLOAD_ENDPOINT_URL');
export const NAMEFORUPLOADCOMPLETION = getConfig('NAMEFORUPLOADCOMPLETION');
// Export S3 configuration
export const S3_ENDPOINT = getConfig('S3_ENDPOINT');
export const S3_REGION = getConfig('S3_REGION');
export const S3_BUCKET = getConfig('S3_BUCKET');
// Export Companion configuration
export const COMPANION_URL = getConfig('COMPANION_URL'); // URL for Companion (used by Dropbox, Google Drive, etc.)
// export const COMPANION_AWS_ENDPOINT = getConfig('COMPANION_AWS_ENDPOINT'); // Removed
export const USE_COMPANION = getConfig('USE_COMPANION') === 'true'; // Still relevant for providers like Dropbox/Google Drive
// Export Provider configuration
export const ENABLE_DROPBOX = getConfig('ENABLE_DROPBOX') === 'true';
export const ENABLE_GOOGLE_DRIVE = getConfig('ENABLE_GOOGLE_DRIVE') === 'true';
export const GOOGLE_DRIVE_CLIENT_ID = getConfig('GOOGLE_DRIVE_CLIENT_ID');
export const GOOGLE_DRIVE_API_KEY = getConfig('GOOGLE_DRIVE_API_KEY');
export const GOOGLE_DRIVE_APP_ID = getConfig('GOOGLE_DRIVE_APP_ID');

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
    UPLOAD_ENDPOINT_URL,
    NAMEFORUPLOADCOMPLETION,
    S3_ENDPOINT,
    S3_REGION,
    S3_BUCKET,
    COMPANION_URL,
    // COMPANION_AWS_ENDPOINT, // Removed
    USE_COMPANION,
    ENABLE_DROPBOX,
    ENABLE_GOOGLE_DRIVE,
    GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_API_KEY,
    GOOGLE_DRIVE_APP_ID,
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
  OVENPLAYER_SCRIPT_URL,
  UPLOAD_ENDPOINT_URL,
  NAMEFORUPLOADCOMPLETION,
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  COMPANION_URL,
  // COMPANION_AWS_ENDPOINT, // Removed
  USE_COMPANION,
  ENABLE_DROPBOX,
  ENABLE_GOOGLE_DRIVE,
  GOOGLE_DRIVE_CLIENT_ID,
  GOOGLE_DRIVE_API_KEY,
  GOOGLE_DRIVE_APP_ID
}; 
