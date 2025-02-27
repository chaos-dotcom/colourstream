import axios, { AxiosError, AxiosRequestConfig } from 'axios';
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

// Create axios instance with retry capability
export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle token expiration and rate limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle token expiration
    if (error.response?.status === 401) {
      // Clear auth state
      localStorage.removeItem('adminToken');
      localStorage.removeItem('isAdminAuthenticated');
      
      // Store error message for login page
      localStorage.setItem('authError', 'Your session has expired. Please log in again.');
      
      // Redirect to login page
      window.location.href = '/admin/login';
      return Promise.reject(error);
    }
    
    // Handle rate limiting with exponential backoff retry
    if (error.response?.status === 429 && !originalRequest._retry) {
      // Initialize retry count if not set
      originalRequest._retryCount = originalRequest._retryCount || 0;
      
      // Maximum number of retries
      const maxRetries = 3;
      
      // Check if we've reached max retries
      if (originalRequest._retryCount < maxRetries) {
        originalRequest._retryCount++;
        originalRequest._retry = true;
        
        // Calculate delay with exponential backoff (1s, 2s, 4s)
        const delay = Math.pow(2, originalRequest._retryCount - 1) * 1000;
        
        console.log(`Rate limit exceeded. Retrying in ${delay}ms... (Attempt ${originalRequest._retryCount} of ${maxRetries})`);
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return api(originalRequest);
      }
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
  mirotalkUsername?: string;
  mirotalkPassword?: string;
}

export interface Room {
  id: string;
  name: string;
  link: string;
  presenterLink: string;
  expiryDate: string;
  mirotalkRoomId: string;
  streamKey: string;
  displayPassword: string;
  password: string;
}

export interface RoomConfig {
  mirotalkRoomId: string;
  streamKey: string;
  mirotalkToken: string;
  isPresenter?: boolean;
}

export interface OBSSettings {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';
  srtUrl?: string;
  protocol?: 'rtmp' | 'srt';
}

export interface SetupStatus {
  setupRequired: boolean;
  hasPasskeys: boolean;
}

export interface OBSConnectionStatus {
  status: 'disconnected' | 'connected' | 'connecting' | 'error';
  error?: string;
}

export interface TokenGenerationRequest {
  roomId: string;
  name: string;
  isPresenter: boolean;
  expireTime?: string;
}

export interface TokenGenerationResponse {
  url: string;
  token: string;
  expiresIn: number;
}

export interface DefaultMiroTalkCredentials {
  username: string;
  password: string;
}

export interface OIDCConfig {
  id: string;
  enabled: boolean;
  providerName: string;
  clientId: string | null;
  clientSecret: string | null;
  discoveryUrl: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  userInfoUrl: string | null;
  scope: string;
  redirectUri: string | null;
  logoutUrl: string | null;
  group: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OIDCConfigResponse {
  config: OIDCConfig | null;
  isInitialized: boolean;
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
  return response.data;
};

export const createRoom = async (roomData: CreateRoomData): Promise<ApiResponse<{ room: Room }>> => {
  console.log('Creating room with data:', {
    ...roomData,
    password: roomData.password ? '***' : null, // Mask password for security
  });
  
  const response = await api.post('/rooms', roomData);
  console.log('Room creation response:', response.data);
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

export const validateRoomAccess = async (roomId: string, password: string, isPresenter: boolean = false): Promise<RoomConfig> => {
  try {
    const response = await api.post(`/rooms/validate/${roomId}`, { password, isPresenter });
    const result = response.data as ApiResponse<RoomConfig>;
    return result.data;
  } catch (error: any) {
    // Extract error message from the response if available
    const errorMessage = error.response?.data?.message || 'Failed to validate room access';
    throw new Error(errorMessage);
  }
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

export const updateOBSSettings = async (settings: OBSSettings): Promise<{ settings: OBSSettings, warning?: string }> => {
  const response = await api.put('/obs/settings', settings);
  const result = response.data as ApiResponse<{ settings: OBSSettings, warning?: string }>;
  return { 
    settings: result.data.settings,
    warning: result.data.warning
  };
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

export const stopOBSStream = async (): Promise<void> => {
  const response = await api.post('/obs/stream/stop');
  return response.data;
};

export const checkSetupRequired = async (): Promise<ApiResponse<SetupStatus>> => {
  try {
    const response = await api.get('/auth/setup-required');
    return response.data;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      status: 'error',
      message: 'Failed to check setup status',
      data: {
        setupRequired: false,
        hasPasskeys: false
      }
    };
  }
};

export const firstTimeSetup = async (): Promise<ApiResponse<AuthResponse>> => {
  try {
    // Step 1: Get registration options from the server
    const response = await api.post('/auth/webauthn/first-time-setup');
    if (!response.data) {
      throw new Error('No registration options received from server');
    }
    
    // Step 2: Start the registration process in the browser
    try {
      const credential = await startRegistration(response.data);
      
      // Step 3: Send the credential back to the server for verification
      const verificationResponse = await api.post('/auth/webauthn/first-time-setup/verify', credential);
      
      // Step 4: Store the authentication token
      const result = verificationResponse.data;
      console.log('Verification response received:', JSON.stringify(result, null, 2));
      
      // Check if the token is in the expected location in the response
      if (result.data && result.data.token) {
        localStorage.setItem('adminToken', result.data.token);
        localStorage.setItem('isAdminAuthenticated', 'true');
        
        return {
          status: 'success',
          data: {
            token: result.data.token,
            verified: true
          }
        };
      } else if (result.token) {
        // Alternative location - directly in the result
        localStorage.setItem('adminToken', result.token);
        localStorage.setItem('isAdminAuthenticated', 'true');
        
        return {
          status: 'success',
          data: {
            token: result.token,
            verified: true
          }
        };
      } else {
        console.error('Token not found in response:', result);
        throw new Error('Registration successful but no token received');
      }
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      throw new Error('Failed to register passkey');
    }
  } catch (error: any) {
    console.error('Passkey setup error:', error);
    throw new Error('Failed to set up passkey');
  }
};

export const registerPasskey = async (): Promise<ApiResponse<WebAuthnRegistrationResponse>> => {
  try {
    // Step 1: Get registration options from the server
    const response = await api.post('/auth/webauthn/register');
    if (!response.data) {
      throw new Error('No registration options received from server');
    }
    
    // Step 2: Start the registration process in the browser
    try {
      const credential = await startRegistration(response.data);
      
      // Step 3: Send the credential back to the server for verification
      const verificationResponse = await api.post('/auth/webauthn/register/verify', credential);
      
      return {
        status: 'success',
        data: verificationResponse.data
      };
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      throw new Error('Failed to register passkey');
    }
  } catch (error: any) {
    console.error('Passkey registration error:', error);
    throw new Error('Failed to register passkey');
  }
};

export const authenticateWithPasskey = async (): Promise<ApiResponse<AuthResponse>> => {
  try {
    // Step 1: Get authentication options from the server
    const response = await api.post('/auth/webauthn/authenticate');
    if (!response.data) {
      throw new Error('No authentication options received from server');
    }
    
    // Log the options for debugging
    console.log('Authentication options received:', response.data);
    
    // Step 2: Start the authentication process in the browser
    try {
      // Make sure we're using the raw response data without type casting
      // This ensures we pass exactly what the browser expects
      const credential = await startAuthentication(response.data);
      
      console.log('Authentication credential created:', credential);
      
      // Step 3: Send the credential back to the server for verification
      const verificationResponse = await api.post('/auth/webauthn/authenticate/verify', credential);
      console.log('Verification response:', verificationResponse.data);
      
      // Update to handle the new response format
      const result = verificationResponse.data;
      
      // Step 4: Store the authentication token
      if (result.data && result.data.token) {
        localStorage.setItem('adminToken', result.data.token);
        localStorage.setItem('isAdminAuthenticated', 'true');
        
        return {
          status: 'success',
          data: {
            token: result.data.token
          }
        };
      } else {
        console.error('No token received in authentication response:', result);
        throw new Error('Authentication successful but no token received');
      }
    } catch (error: any) {
      console.error('WebAuthn authentication error:', {
        name: error.name,
        message: error.message,
        error
      });
      
      // Handle browser-level WebAuthn errors with clear user messages
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
      } else if (error.name === 'NotSupportedError') {
        throw new Error('WebAuthn is not supported in this browser or environment');
      }
      
      throw new Error(`Authentication failed: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Passkey authentication error:', error);
    
    // Extract the error message from the response if available
    const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         error.message || 
                         'Failed to authenticate with passkey';
    
    throw new Error(errorMessage);
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

export const adminLogout = (): void => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('isAdminAuthenticated');
  window.location.href = '/admin/login';
};

export const getOBSConnectionStatus = async (): Promise<OBSConnectionStatus> => {
  const response = await api.get('/obs/status');
  const result = response.data as ApiResponse<OBSConnectionStatus>;
  return result.data;
};

export const generateMirotalkToken = async (
  request: TokenGenerationRequest
): Promise<ApiResponse<TokenGenerationResponse>> => {
  const response = await api.post('/mirotalk/generate-token', request);
  return response.data as ApiResponse<TokenGenerationResponse>;
};

export const getDefaultMiroTalkCredentials = async (): Promise<DefaultMiroTalkCredentials> => {
  try {
    const response = await fetch(`${baseURL}/mirotalk/default-credentials`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch default MiroTalk credentials');
    }

    const data = await response.json();
    return data.data.defaultCredentials;
  } catch (error) {
    console.error('Error fetching default MiroTalk credentials:', error);
    // Return default values if API call fails
    return {
      username: 'globalUsername',
      password: 'globalPassword'
    };
  }
};

export const getOIDCConfig = async (): Promise<OIDCConfigResponse> => {
  try {
    console.log('Fetching OIDC config...');
    const response = await api.get('/auth/oidc/config');
    console.log('OIDC config response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to get OIDC config:', error);
    return { config: null, isInitialized: false };
  }
};

export const updateOIDCConfig = async (config: OIDCConfig): Promise<OIDCConfigResponse> => {
  try {
    const response = await api.post('/auth/oidc/config', config);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Failed to update OIDC configuration');
  }
};

export const getOIDCLoginUrl = async (redirectUrl?: string): Promise<string> => {
  try {
    const params = redirectUrl ? { redirectUrl } : {};
    console.log('Getting OIDC login URL with params:', params);
    const response = await api.get('/auth/oidc/login', { params });
    console.log('OIDC login URL response:', response.data);
    return response.data.data.url;
  } catch (error) {
    console.error('Failed to get OIDC login URL:', error);
    throw error;
  }
};

export const loginWithOIDC = async (redirectUrl: string): Promise<void> => {
  try {
    const params = { redirectUrl };
    console.log('Initiating OIDC login with params:', params);
    const response = await api.get('/auth/oidc/login', { params });
    console.log('OIDC login response:', response.data);
    
    if (response.data?.data?.url) {
      // Check if the URL is valid
      if (response.data.data.url.startsWith('undefined')) {
        console.error('Invalid OIDC authorization URL:', response.data.data.url);
        throw new Error('Invalid OIDC authorization URL. Please check your OIDC configuration.');
      }
      window.location.href = response.data.data.url;
    } else {
      throw new Error('No redirect URL received from OIDC provider');
    }
  } catch (error) {
    console.error('OIDC login error:', error);
    throw error;
  }
};

export const handleOIDCCallback = (token: string): void => {
  console.log('Handling OIDC callback with token:', token.substring(0, 10) + '...');
  localStorage.setItem('adminToken', token);
  localStorage.setItem('isAdminAuthenticated', 'true');
  window.location.href = '/admin/dashboard';
}; 