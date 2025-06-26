import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

export type WebAuthnRegistrationResponse = RegistrationResponseJSON;

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
}

export interface AuthResponse {
  token: string;
  verified?: boolean;
}

export interface PasskeyInfo {
  id: string;
  credentialId: string;
  lastUsed: string;
  createdAt: string;
}

// OIDC related types
interface OIDCConfig {
  id?: string;
  enabled: boolean;
  providerName: string;
  clientId: string;
  clientSecret?: string;
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scope?: string;
  redirectUri?: string;
  logoutUrl?: string;
  group?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Interface for active upload data received via WebSocket
export interface ActiveUpload {
  id: string; // Corresponds to Uppy file ID
  fileName: string;
  size: number;
  offset: number;
  percentage: number;
  speed?: number; // Optional speed in bytes/sec
  clientName: string;
  projectName: string;
  startTime: string; // ISO string date
  lastUpdate: string; // ISO string date
  storage: string;
  isComplete?: boolean; // Flag from backend
}
