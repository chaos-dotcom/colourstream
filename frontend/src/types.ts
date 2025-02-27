import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';

export type WebAuthnRegistrationOptions = PublicKeyCredentialCreationOptionsJSON;
export type WebAuthnAuthenticationOptions = PublicKeyCredentialRequestOptionsJSON;
export type WebAuthnRegistrationResponse = RegistrationResponseJSON;
export type WebAuthnAuthenticationResponse = AuthenticationResponseJSON;

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
export interface OIDCConfig {
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

export interface OIDCConfigResponse {
  config: OIDCConfig | null;
  isInitialized: boolean;
  clientSecret?: string | null;
} 