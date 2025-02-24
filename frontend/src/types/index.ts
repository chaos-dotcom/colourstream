// WebAuthn types
export interface AuthenticatorDevice {
  id: string;
  type: 'public-key';
  transports?: AuthenticatorTransport[];
}

export interface WebAuthnRegistrationResponse {
  id: string;
  rawId: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
  type: string;
  transports?: AuthenticatorTransport[];
}

export interface WebAuthnAuthenticationResponse {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle: string | null;
  };
  type: string;
}

export interface WebAuthnRegistrationOptions {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: {
    alg: number;
    type: 'public-key';
  }[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: AuthenticatorDevice[];
}

export interface WebAuthnAuthenticationOptions {
  challenge: string;
  rpId: string;
  allowCredentials?: AuthenticatorDevice[];
  userVerification?: UserVerificationRequirement;
  timeout?: number;
} 