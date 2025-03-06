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

// Use the environment variable if available, otherwise fall back to window.location.origin
const baseURL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

// Log the API URL for debugging
console.log('API environment:', import.meta.env.MODE);
console.log('API baseURL:', baseURL);

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
  
  // Log all API requests for debugging
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config);
  
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error(`API Error: ${error.config?.url}`, error);
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

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
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

export const authenticateWithPasskey = async (): Promise<AuthResult> => {
  try {
    console.log('Starting passkey authentication');
    
    // Step 1: Get authentication options from the server
    const optionsResponse = await axios.post(`${baseURL}/auth/webauthn/authenticate`);
    console.log('Authentication options response:', optionsResponse);
    
    if (!optionsResponse.data) {
      console.error('No authentication options received');
      return { success: false, error: 'No authentication options received' };
    }
    
    const options = optionsResponse.data;
    console.log('Authentication options:', options);
    
    // Step 2: Create authentication credential in the browser
    const credential = await startAuthentication(options);
    console.log('Created authentication credential:', credential);
    
    // Step 3: Send the credential to the server for verification
    const verificationResponse = await axios.post(`${baseURL}/auth/webauthn/authenticate/verify`, credential);
    console.log('Verification response:', verificationResponse);
    
    // Extract token from the correct location in the response
    const responseData = verificationResponse.data;
    
    if (responseData?.status === 'success' && responseData?.data?.token) {
      const token = responseData.data.token;
      console.log('Authentication token received, setting auth state');
      
      // Store auth token consistently
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      localStorage.setItem('authToken', token);
      localStorage.setItem('authTimestamp', Date.now().toString());
      
      // Apply token to axios default headers for subsequent requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return { success: true, token: token };
    } else {
      console.error('No token received from verification, response data:', responseData);
      return { success: false, error: 'No token received from verification. Please check server logs.' };
    }
  } catch (error: any) {
    console.error('Passkey authentication error:', error);
    
    // Handle specific WebAuthn errors
    if (error.name === 'NotAllowedError') {
      return { success: false, error: 'Authentication was not allowed by the user or the device' };
    } else if (error.name === 'SecurityError') {
      return { success: false, error: 'A security error occurred during authentication' };
    } else if (error.name === 'TypeError') {
      return { success: false, error: 'Invalid parameters were provided for authentication' };
    }
    
    return { 
      success: false, 
      error: error.response?.data?.message || error.message || 'Failed to authenticate with passkey' 
    };
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
    console.log('Getting OIDC config from:', `${baseURL}/auth/oidc/config`);
    const response = await axios.get(`${baseURL}/auth/oidc/config`);
    console.log('OIDC config response:', response);
    
    // Check different possible response structures
    if (response.data?.status === 'success' && response.data?.data) {
      console.log('OIDC config found in response.data.data:', response.data.data);
      return {
        config: response.data.data.config || response.data.data,
        isInitialized: true
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Failed to get OIDC config:', error);
    return { config: null, isInitialized: false };
  }
};

export const updateOIDCConfig = async (config: OIDCConfig): Promise<OIDCConfigResponse> => {
  try {
    console.log('Updating OIDC config at:', `${baseURL}/auth/oidc/config`);
    console.log('OIDC config payload:', config);
    const response = await axios.post(`${baseURL}/auth/oidc/config`, config);
    console.log('OIDC config update response:', response);
    return response.data;
  } catch (error: any) {
    console.error('Failed to update OIDC config:', error);
    throw new Error(error.response?.data?.message || 'Failed to update OIDC configuration');
  }
};

export const loginWithOIDC = async (redirectUrl: string): Promise<void> => {
  try {
    console.log('Initiating OIDC login flow');
    
    // Get the OIDC configuration first
    const oidcConfig = await getOIDCConfig();
    
    if (!oidcConfig.config?.enabled) {
      console.error('OIDC is not enabled');
      throw new Error('OIDC authentication is not enabled');
    }
    
    console.log('OIDC is enabled, proceeding with login');
    
    // Normalize the redirect URL to ensure we only store the path
    let normalizedRedirectUrl = redirectUrl;
    if (redirectUrl.startsWith('http')) {
      try {
        const url = new URL(redirectUrl);
        normalizedRedirectUrl = url.pathname + url.search + url.hash;
      } catch (e) {
        console.error('Error parsing redirect URL, using as is:', e);
      }
    }
    console.log('Original redirect URL:', redirectUrl);
    console.log('Normalized redirect URL:', normalizedRedirectUrl);
    
    // Store the redirect URL in localStorage to use after successful authentication
    localStorage.setItem('oidcRedirectUrl', normalizedRedirectUrl);
    
    // Generate a nonce for security
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oidcNonce', nonce);
    
    // Generate a state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oidcState', state);
    console.log('Generated state parameter:', state);
    
    // Use a frontend callback URL instead of the API route to avoid conflicts
    // This callback will be handled by our React router
    const callbackUrl = `${window.location.origin}/auth/callback`;
    console.log('Using callback URL:', callbackUrl);
    
    // Construct the authorization URL with the proper parameters
    const params = new URLSearchParams({
      client_id: oidcConfig.config?.clientId || 'colourstream-admin',
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: oidcConfig.config?.scope || 'openid profile email',
      nonce: nonce,
      state: state // Add explicit state parameter
    });
    
    // Use the correct authorization endpoint from environment variable
    const authEndpoint = import.meta.env.VITE_OIDC_AUTH_ENDPOINT || `${window.location.origin}/authorize`;
    const authUrl = `${authEndpoint}?${params.toString()}`;
    
    console.log('Redirecting to SSO provider:', authUrl);
    
    // Redirect to the authorization URL
    window.location.href = authUrl;
  } catch (error) {
    console.error('Failed to initiate OIDC login:', error);
    throw error;
  }
};

export const getOIDCUserProfile = async (): Promise<any> => {
  try {
    const response = await api.get('/auth/oidc/profile');
    return response.data;
  } catch (error) {
    console.error('Failed to get OIDC user profile:', error);
    throw error;
  }
};

export const getOIDCToken = async (): Promise<string> => {
  try {
    const response = await api.get('/auth/oidc/token');
    if (response.data?.data?.token) {
      return response.data.data.token;
    }
    throw new Error('No token received');
  } catch (error) {
    console.error('Failed to get OIDC token:', error);
    throw error;
  }
};

export const handleOIDCCallback = async (): Promise<AuthResult> => {
  try {
    console.log('Handling OIDC callback');
    
    // First check if we already have a token in the URL (backend redirect scenario)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('Token found directly in URL, setting auth state');
      
      // Store auth token consistently with same pattern as passkey auth
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      localStorage.setItem('authToken', token);
      localStorage.setItem('authTimestamp', Date.now().toString());
      
      // Apply token to axios default headers for subsequent requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Remove token from URL (for security)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Get the stored redirect URL if any
      const redirectUrl = localStorage.getItem('oidcRedirectUrl');
      if (redirectUrl) {
        localStorage.removeItem('oidcRedirectUrl'); // Clean up
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 300);
      }
      
      return { success: true, token: token };
    }
    
    // If no token in URL, proceed with the original flow
    const code = urlParams.get('code');
    
    if (!code) {
      console.error('No authorization code found in callback URL');
      return { success: false, error: 'No authorization code found in callback URL' };
    }
    
    console.log('Got authorization code, exchanging for token');
    
    try {
      // The backend should handle the code exchange and state validation
      const response = await axios.get(`${baseURL}/api/auth/oidc/callback${window.location.search}`);
      
      console.log('OIDC callback response:', response);
      
      if (response.data && response.data.token) {
        const responseToken = response.data.token;
        console.log('OIDC authentication token received, setting auth state');
        
        // Store auth token consistently with same pattern as passkey auth
        localStorage.setItem('adminToken', responseToken);
        localStorage.setItem('isAdminAuthenticated', 'true');
        localStorage.setItem('authToken', responseToken);
        localStorage.setItem('authTimestamp', Date.now().toString());
        
        // Apply token to axios default headers for subsequent requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${responseToken}`;
        
        // Get the stored redirect URL if any
        const redirectUrl = localStorage.getItem('oidcRedirectUrl');
        if (redirectUrl) {
          localStorage.removeItem('oidcRedirectUrl'); // Clean up
          console.log('Redirecting to:', redirectUrl);
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 300);
        }
        
        return { success: true, token: responseToken };
      } else {
        console.error('No token received from OIDC callback');
        return { success: false, error: 'No token received from OIDC callback' };
      }
    } catch (error: any) {
      console.error('OIDC callback error:', error);
      
      // Check for specific OIDC errors
      if (error.response?.status === 400) {
        return { 
          success: false, 
          error: 'Invalid OIDC authorization request. This may be due to an invalid state parameter or expired session. Please try logging in again.' 
        };
      }
      
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to process OIDC callback' 
      };
    }
  } catch (error: any) {
    console.error('OIDC callback error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to process OIDC callback' 
    };
  }
}; 