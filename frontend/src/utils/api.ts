import axios from 'axios';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  ApiResponse,
  AuthResponse,
  PasskeyInfo,
  WebAuthnRegistrationResponse,
  // WebAuthnRegistrationOptions, // Removed as unused
  // WebAuthnAuthenticationOptions, // Removed as unused
} from '../types';
import { API_URL } from '../config';

// Create axios instance with retry capability
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
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

    // Check if the options are nested in an 'options' property
    const registrationOptions = response.data.options || response.data;

    // Log the registration options for debugging
    console.log('Server registration options:', response.data);

    // Validate that we have the expected WebAuthn options structure
    if (!registrationOptions.challenge || !registrationOptions.rp) {
      console.log('Invalid options received from server:', response.data);
      throw new Error('Server returned invalid registration options');
    }

    // Step 2: Start the registration process in the browser
    try {
      const credential = await startRegistration(registrationOptions);

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

    // Check if the options are nested in an 'options' property
    const registrationOptions = response.data.options || response.data;

    // Log the registration options for debugging
    console.log('Server registration options:', response.data);

    // Validate that we have the expected WebAuthn options structure
    if (!registrationOptions.challenge || !registrationOptions.rp) {
      console.log('Invalid options received from server:', response.data);
      throw new Error('Server returned invalid registration options');
    }

    // Step 2: Start the registration process in the browser
    try {
      const credential = await startRegistration(registrationOptions);

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
    try {
      const optionsResponse = await axios.post(`${API_URL}/auth/webauthn/authenticate`);
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
      const verificationResponse = await axios.post(`${API_URL}/auth/webauthn/authenticate/verify`, credential);
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
    } catch (apiError: any) {
      // Specifically catch the "No passkey registered" error
      if (apiError.response?.status === 400 && apiError.response?.data?.message === 'No passkey registered') {
        console.log('No passkey registered, need to set one up');
        // Set a flag to redirect to passkey registration page
        localStorage.setItem('needsPasskeySetup', 'true');
        // Redirect to passkey registration page (unprotected route)
        window.location.href = '/setup-passkey';
        return { success: false, error: 'No passkey registered. Redirecting to registration...' };
      }
      // Re-throw other API errors
      throw apiError;
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
    const response = await fetch(`${API_URL}/mirotalk/default-credentials`, {
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
    console.log('Getting OIDC config from:', `${API_URL}/auth/oidc/config`);
    const response = await axios.get(`${API_URL}/auth/oidc/config`);
    console.log('OIDC config response:', response);

    // Check different possible response structures
    if (response.data?.status === 'success' && response.data?.data) {
      console.log('OIDC config found in response.data.data:', response.data.data);
      return {
        config: response.data.data.config || response.data.data,
        isInitialized: true
      };
    } else if (response.data?.config) {
      console.log('OIDC config found in response.data.config:', response.data.config);
      return {
        config: response.data.config,
        isInitialized: true
      };
    } else {
      console.log('OIDC config not found or not initialized:', response.data);
      return {
        config: null,
        isInitialized: false
      };
    }
  } catch (error) {
    console.error('Error fetching OIDC config:', error);
    return {
      config: null,
      isInitialized: false
    };
  }
};


export const updateOIDCConfig = async (config: OIDCConfig): Promise<OIDCConfigResponse> => {
  try {
    const response = await api.put('/auth/oidc/config', config);
    return response.data.data;
  } catch (error) {
    console.error('Error updating OIDC config:', error);
    throw new Error('Failed to update OIDC config');
  }
};

export const loginWithOIDC = async (redirectUrl: string): Promise<void> => {
  try {
    // Get the OIDC authorization URL from the backend
    const response = await api.post('/auth/oidc/login', { redirectUrl });
    const { authorizationUrl } = response.data.data;

    if (!authorizationUrl) {
      throw new Error('Authorization URL not provided by backend');
    }

    // Redirect the user to the OIDC provider's login page
    window.location.href = authorizationUrl;
  } catch (error) {
    console.error('OIDC login initiation failed:', error);
    throw new Error('Failed to initiate OIDC login');
  }
};

export const getOIDCUserProfile = async (): Promise<any> => {
  try {
    const response = await api.get('/auth/oidc/profile');
    return response.data.data.profile;
  } catch (error) {
    console.error('Error fetching OIDC user profile:', error);
    throw new Error('Failed to fetch OIDC user profile');
  }
};

export const getOIDCToken = async (): Promise<string> => {
  try {
    const response = await api.get('/auth/oidc/token');
    return response.data.data.token;
  } catch (error) {
    console.error('Error fetching OIDC token:', error);
    throw new Error('Failed to fetch OIDC token');
  }
};


export const handleOIDCCallback = async (): Promise<AuthResult> => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (!code || !state) {
      throw new Error('Missing code or state in OIDC callback');
    }

    // Send the code and state to the backend for verification
    const response = await api.post('/auth/oidc/callback', { code, state });

    if (response.data?.status === 'success' && response.data?.data?.token) {
      const token = response.data.data.token;
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      localStorage.setItem('authToken', token);
      localStorage.setItem('authTimestamp', Date.now().toString());
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true, token };
    } else {
      throw new Error(response.data?.message || 'OIDC callback verification failed');
    }
  } catch (error: any) {
    console.error('OIDC callback handling failed:', error);
    return { success: false, error: error.message || 'Failed to handle OIDC callback' };
  }
};


// Function to register the first passkey during initial setup
export const registerFirstPasskey = async (): Promise<ApiResponse<AuthResponse>> => {
  try {
    // 1. Get registration options
    const optionsResponse = await api.post('/auth/webauthn/register-first');
    const registrationOptions = optionsResponse.data.data.options;

    if (!registrationOptions) {
      throw new Error('Failed to get registration options for first passkey.');
    }

    // 2. Start browser registration
    let credential;
    try {
      credential = await startRegistration(registrationOptions);
    } catch (registrationError: any) {
      console.error('Browser passkey registration failed:', registrationError);
      // Handle specific errors like cancellation
      if (registrationError.name === 'NotAllowedError') {
        throw new Error('Passkey registration cancelled by user.');
      }
      throw new Error('Failed to create passkey in browser.');
    }

    // 3. Verify credential with backend
    const verificationResponse = await api.post('/auth/webauthn/register-first/verify', credential);

    if (verificationResponse.data?.status === 'success' && verificationResponse.data?.data?.token) {
      // Store token and mark as authenticated
      const token = verificationResponse.data.data.token;
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      localStorage.setItem('authToken', token);
      localStorage.setItem('authTimestamp', Date.now().toString());
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      return {
        status: 'success',
        data: { token, verified: true } // Assuming AuthResponse structure
      };
    } else {
      throw new Error(verificationResponse.data?.message || 'Failed to verify first passkey.');
    }
  } catch (error: any) {
    console.error('Error registering first passkey:', error);
    return {
      status: 'error',
      message: error.message || 'An unknown error occurred during first passkey registration.',
      data: { token: '', verified: false } // Return appropriate error structure
    };
  }
};

// Helper function to get Authorization header
export const getAuthHeaders = (): { [key: string]: string } => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};
