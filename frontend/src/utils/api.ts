import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type { 
  ApiResponse, 
  AuthResponse,
  PasskeyInfo,
  WebAuthnRegistrationResponse,
  WebAuthnRegistrationOptions,
  WebAuthnAuthenticationOptions,
} from '../types';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export type { PasskeyInfo };

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  // Don't add token for login endpoint
  if (config.url?.endsWith('/auth/login')) {
    return config;
  }
  
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state
      localStorage.removeItem('adminToken');
      localStorage.removeItem('isAdminAuthenticated');
      
      // Store error message for login page
      localStorage.setItem('authError', 'Your session has expired. Please log in again.');
      
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

interface RoomsResponse {
  rooms: Room[];
}

interface CleanupResponse {
  deletedCount: number;
}

export interface CreateRoomData {
  name: string;
  password: string;
  expiryDays: number;
}

export interface Room {
  id: string;
  name: string;
  link: string;
  expiryDate: string;
  mirotalkRoomId: string;
  streamKey: string;
  displayPassword: string;
}

export interface RoomConfig {
  mirotalkRoomId: string;
  streamKey: string;
}

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

export const adminLogin = async (password: string): Promise<ApiResponse<AuthResponse>> => {
  const response = await api.post('/auth/login', { password });
  const result = response.data as ApiResponse<AuthResponse>;
  const { token } = result.data;
  localStorage.setItem('adminToken', token);
  localStorage.setItem('isAdminAuthenticated', 'true');
  return result;
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<ApiResponse<void>> => {
  const response = await api.post('/auth/change-password', { currentPassword, newPassword });
  return response.data as ApiResponse<void>;
};

export const createRoom = async (roomData: CreateRoomData): Promise<ApiResponse<{ room: Room }>> => {
  const response = await api.post('/rooms', roomData);
  return response.data as ApiResponse<{ room: Room }>;
};

export const getRooms = async (): Promise<Room[]> => {
  const response = await api.get('/rooms');
  const result = response.data as ApiResponse<RoomsResponse>;
  return result.data.rooms;
};

export const deleteRoom = async (roomId: string): Promise<ApiResponse<null>> => {
  const response = await api.delete(`/rooms/${roomId}`);
  return response.data as ApiResponse<null>;
};

export const validateRoomAccess = async (roomId: string, password: string): Promise<RoomConfig> => {
  const response = await api.post(`/rooms/validate/${roomId}`, { password });
  const result = response.data as ApiResponse<RoomConfig>;
  return result.data;
};

export const cleanupExpiredRooms = async (): Promise<ApiResponse<CleanupResponse>> => {
  const response = await api.delete('/rooms/cleanup/expired');
  return response.data as ApiResponse<CleanupResponse>;
};

export const getOBSSettings = async (): Promise<OBSSettings> => {
  const response = await api.get('/obs/settings');
  const result = response.data as ApiResponse<{ settings: OBSSettings }>;
  return result.data.settings;
};

export const updateOBSSettings = async (settings: OBSSettings): Promise<OBSSettings> => {
  const response = await api.put('/obs/settings', settings);
  const result = response.data as ApiResponse<{ settings: OBSSettings }>;
  return result.data.settings;
};

export const setOBSStreamKey = async (streamKey: string): Promise<void> => {
  // First get the current settings to know which protocol to use
  const settings = await getOBSSettings();
  const response = await api.post('/obs/set-stream-key', { 
    streamKey,
    protocol: settings.protocol || 'rtmp'  // Use protocol instead of streamType
  });
  return response.data;
};

export const registerPasskey = async (): Promise<any> => {
  const response = await api.post('/auth/webauthn/register');
  const options = response.data as WebAuthnRegistrationOptions;
  
  try {
    const credential = await startRegistration(options) as WebAuthnRegistrationResponse;
    const verificationResponse = await api.post('/auth/webauthn/register/verify', credential);
    return verificationResponse.data;
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      throw new Error('User declined to register passkey');
    }
    throw error;
  }
};

export const authenticateWithPasskey = async (): Promise<ApiResponse<AuthResponse>> => {
  try {
    const response = await api.post('/auth/webauthn/authenticate');
    if (!response.data) {
      throw new Error('No authentication options received from server');
    }
    
    const options: WebAuthnAuthenticationOptions = response.data;
    console.log('Authentication options received:', options);

    try {
      const credential = await startAuthentication(options);
      console.log('Authentication credential created:', credential);
      
      const verificationResponse = await api.post('/auth/webauthn/authenticate/verify', credential);
      console.log('Verification response:', verificationResponse.data);
      
      const result = verificationResponse.data as ApiResponse<AuthResponse>;
      const { token } = result.data;
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      return result;
    } catch (error: any) {
      console.error('WebAuthn authentication error:', {
        name: error.name,
        message: error.message,
        error
      });
      
      // Handle browser-level WebAuthn errors
      if (error.name === 'NotAllowedError') {
        throw new Error('User declined to authenticate with passkey');
      } else if (error.name === 'SecurityError') {
        throw new Error('Security error: The origin is not secure or does not match the registered origin');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Invalid authentication state. Please try again.');
      } else if (error.name === 'AbortError') {
        throw new Error('Authentication was aborted. Please try again.');
      } else if (error.name === 'TypeError') {
        throw new Error('Authentication failed: Invalid response from authenticator');
      }
      
      throw new Error(`Authentication failed: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Passkey authentication error:', {
      name: error.name,
      message: error.message,
      response: error.response,
      error
    });

    // If the error was already handled and transformed, just rethrow it
    if (error.message && (
      error.message.startsWith('User declined') ||
      error.message.startsWith('Invalid authentication') ||
      error.message.startsWith('Authentication failed') ||
      error.message.startsWith('Security error') ||
      error.message.startsWith('Authentication was aborted')
    )) {
      throw error;
    }
    
    // Handle API-level errors
    if (error.response?.status === 400) {
      if (error.response.data?.message === 'No passkey registered') {
        throw new Error('No passkey registered. Please log in with password first to register a passkey.');
      }
    }
    
    // For any other errors, throw with a generic message
    throw new Error(error.response?.data?.message || 'Failed to authenticate with passkey');
  }
};

export const getPasskeys = async (): Promise<PasskeyInfo[]> => {
  const response = await api.get('/auth/webauthn/credentials');
  return response.data.data.credentials;
};

export const removePasskey = async (credentialId: string): Promise<void> => {
  const response = await api.delete(`/auth/webauthn/credentials/${credentialId}`);
  return response.data;
};

export const removePassword = async (): Promise<void> => {
  const response = await api.post('/auth/remove-password');
  return response.data;
};

export const hasPassword = async (): Promise<boolean> => {
  const response = await api.get('/auth/has-password');
  return response.data.data.hasPassword;
}; 