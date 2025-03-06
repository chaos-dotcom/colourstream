import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as child_process from 'child_process';

// We'll use a different approach for ESM modules
const prisma = new PrismaClient();

// Function to start the wrapper script
let wrapperProcess: child_process.ChildProcess | null = null;
let wrapperPort: number | null = null;

const startWrapperProcess = async (): Promise<number> => {
  if (wrapperPort) return wrapperPort;
  
  const wrapperScriptPath = path.join(__dirname, 'oidc-wrapper.mjs');
  
  return new Promise((resolve, reject) => {
    wrapperProcess = child_process.spawn('node', [wrapperScriptPath]);
    
    if (!wrapperProcess || !wrapperProcess.stdout || !wrapperProcess.stderr) {
      reject(new Error('Failed to start wrapper process'));
      return;
    }
    
    let dataBuffer = '';
    wrapperProcess.stdout.on('data', (data) => {
      dataBuffer += data.toString();
      try {
        const { port } = JSON.parse(dataBuffer);
        wrapperPort = port;
        resolve(port);
      } catch (e) {
        // Not complete JSON yet, continue collecting
      }
    });
    
    wrapperProcess.stderr.on('data', (data) => {
      logger.error(`Wrapper process error: ${data}`);
    });
    
    wrapperProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Wrapper process exited with code ${code}`));
      }
    });
    
    // Set a timeout in case the process doesn't start properly
    setTimeout(() => {
      if (!wrapperPort) {
        reject(new Error('Timeout waiting for wrapper process to start'));
      }
    }, 5000);
  });
};

// Function to make a request to the wrapper process
const callWrapper = async (action: string, params: Record<string, string> = {}): Promise<any> => {
  try {
    if (!wrapperPort) {
      wrapperPort = await startWrapperProcess();
    }
    
    const url = new URL(`http://localhost:${wrapperPort}`);
    url.searchParams.append('action', action);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Wrapper request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error calling wrapper: ${errorMessage}`);
    throw error;
  }
};

// Add the AuthUrlData interface at the top of the file
interface AuthUrlData {
  url: string;
  codeVerifier: string;
  nonce: string;
}

/**
 * Initialize OIDC client based on configuration in the database
 */
export async function initializeOIDC(): Promise<boolean> {
  try {
    // Use type assertion to avoid TypeScript errors
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config || !config.enabled) {
      logger.info('OIDC is not enabled or configured');
      return false;
    }

    if (!config.clientId || !config.clientSecret) {
      logger.error('OIDC client ID or secret is missing');
      return false;
    }

    // Start the wrapper process
    try {
      await startWrapperProcess();
      logger.info('OIDC wrapper process started successfully');
      
      // If we have a discovery URL, perform discovery and update the config
      if (config.discoveryUrl) {
        try {
          logger.info(`Performing OIDC discovery from ${config.discoveryUrl}`);
          const discoveryResult = await callWrapper('discover', { 
            discoveryUrl: config.discoveryUrl 
          });
          
          // Update the config with discovered endpoints
          await (prisma as any).OIDCConfig.update({
            where: { id: 'default' },
            data: {
              authorizationUrl: discoveryResult.authorizationUrl,
              tokenUrl: discoveryResult.tokenUrl,
              userInfoUrl: discoveryResult.userInfoUrl,
              updatedAt: new Date()
            }
          });
          
          logger.info('Updated OIDC config with discovered endpoints');
        } catch (error) {
          logger.error('Failed to perform OIDC discovery:', error);
          // Continue even if discovery fails - we'll try again later
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error starting OIDC wrapper process:', error);
      return false;
    }
  } catch (error) {
    logger.error('Error initializing OIDC client:', error);
    return false;
  }
}

/**
 * Get the current OIDC configuration
 */
export async function getOIDCConfig() {
  try {
    // Use type assertion to avoid TypeScript errors
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });

    // Return config without client secret
    if (config) {
      const { clientSecret, ...safeConfig } = config;
      return {
        config: safeConfig,
        isInitialized: wrapperPort !== null,
      };
    }

    // If no config exists, create a default one
    const defaultConfig = await (prisma as any).OIDCConfig.create({
      data: {
        id: 'default',
        enabled: false,
        providerName: 'Generic',
        scope: 'openid profile email',
      },
    });

    const { clientSecret, ...safeConfig } = defaultConfig;
    return {
      config: safeConfig,
      isInitialized: false,
    };
  } catch (error) {
    logger.error('Error getting OIDC config:', error);
    throw error;
  }
}

/**
 * Update OIDC configuration
 */
export async function updateOIDCConfig(configData: any) {
  try {
    // Use type assertion to avoid TypeScript errors
    const updatedConfig = await (prisma as any).OIDCConfig.upsert({
      where: { id: 'default' },
      update: {
        ...configData,
        updatedAt: new Date(),
      },
      create: {
        id: 'default',
        ...configData,
      },
    });

    // Reinitialize OIDC client with new config
    await initializeOIDC();

    // Return config without client secret
    const { clientSecret, ...safeConfig } = updatedConfig;
    return {
      config: safeConfig,
      isInitialized: wrapperPort !== null,
    };
  } catch (error) {
    logger.error('Error updating OIDC config:', error);
    throw error;
  }
}

/**
 * Generate authorization URL for OIDC login
 */
export async function getAuthorizationUrl(redirectUrl: string): Promise<AuthUrlData | null> {
  try {
    // Get the OIDC configuration
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });
    
    if (!config || !config.enabled) {
      throw new Error('OIDC is not enabled or configured');
    }

    // Generate PKCE values
    const { nonce, state, codeVerifier, codeChallenge } = await callWrapper('generate');
    
    logger.debug('Generated PKCE values', { nonce, state, codeVerifier, codeChallenge });

    // Store PKCE values in database
    await (prisma as any).OIDCAuthRequest.create({
      data: {
        state,
        codeVerifier,
        nonce,
        redirectUrl,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
      },
    });

    // Construct authorization URL
    const params = new URLSearchParams();
    if (config.clientId) params.append('client_id', config.clientId);
    params.append('redirect_uri', `${process.env.PUBLIC_URL}/api/auth/oidc/callback`);
    params.append('response_type', 'code');
    params.append('state', state);
    params.append('nonce', nonce);
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
    params.append('scope', config.scope || 'openid profile email');

    const authUrl = `${config.authorizationUrl}?${params.toString()}`;
    logger.debug('Generated authorization URL', { authUrl });

    return {
      url: authUrl,
      codeVerifier,
      nonce
    };
  } catch (error) {
    logger.error('Error generating authorization URL:', error);
    throw error;
  }
}

/**
 * Handle OIDC callback
 */
export async function handleCallback(code: string, state: string) {
  try {
    // Get the OIDC configuration
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });
    
    if (!config || !config.enabled) {
      throw new Error('OIDC is not enabled or configured');
    }
    
    // Get the stored auth request data
    const authRequest = await (prisma as any).OIDCAuthRequest.findUnique({
      where: { state },
    });

    if (!authRequest) {
      throw new Error('Invalid or expired state parameter');
    }

    // Check if the auth request has expired
    if (authRequest.expiresAt < new Date()) {
      await (prisma as any).OIDCAuthRequest.delete({
        where: { state },
      });
      throw new Error('Authorization request has expired');
    }

    try {
      // Use the wrapper to exchange code for tokens
      const exchangeResult = await callWrapper('exchangeToken', {
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        discoveryUrl: config.discoveryUrl || '',
        code,
        redirectUri: `${process.env.PUBLIC_URL}/api/auth/oidc/callback`,
        codeVerifier: authRequest.codeVerifier
      });

      // Clean up the auth request
      await (prisma as any).OIDCAuthRequest.delete({
        where: { state },
      });

      return {
        tokenSet: exchangeResult.tokenSet,
        userInfo: exchangeResult.userInfo,
        redirectUrl: authRequest.redirectUrl,
      };
    } catch (error) {
      logger.error('Error during OIDC token exchange or validation:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error handling OIDC callback:', error);
    throw error;
  }
}

export function isOIDCInitialized(): boolean {
  return wrapperPort !== null;
}

// Create a Map to store state to redirect URL mappings
const stateMap = new Map<string, { redirectUrl: string }>();

export function getRedirectUrlFromState(state: string): string | undefined {
  return stateMap.get(state)?.redirectUrl;
}

/**
 * Initialize OIDC configuration from environment variables
 */
export async function initializeOIDCFromEnv(): Promise<boolean> {
  try {
    // Check if OIDC is enabled in environment variables
    const oidcEnabled = process.env.OIDC_ENABLED === 'true';
    
    if (!oidcEnabled) {
      logger.info('OIDC is not enabled in environment variables');
      return false;
    }
    
    // Get OIDC configuration from environment variables
    const oidcConfig = {
      id: 'default',
      enabled: oidcEnabled,
      providerName: process.env.OIDC_PROVIDER_NAME || 'Generic',
      clientId: process.env.OIDC_CLIENT_ID || null,
      clientSecret: process.env.OIDC_CLIENT_SECRET || null,
      discoveryUrl: process.env.OIDC_DISCOVERY_URL || null,
      redirectUri: process.env.OIDC_REDIRECT_URI || '/auth/callback',
      scope: process.env.OIDC_SCOPE || 'openid profile email',
      group: process.env.OIDC_GROUP || null,
    };
    
    // Check if required fields are present
    if (!oidcConfig.clientId || !oidcConfig.clientSecret) {
      logger.error('OIDC client ID or secret is missing in environment variables');
      return false;
    }
    
    if (!oidcConfig.discoveryUrl) {
      logger.error('OIDC discovery URL is missing in environment variables');
      return false;
    }
    
    // Update the OIDC configuration in the database
    await (prisma as any).OIDCConfig.upsert({
      where: { id: 'default' },
      update: {
        ...oidcConfig,
        updatedAt: new Date(),
      },
      create: {
        ...oidcConfig,
      },
    });
    
    logger.info('OIDC configuration initialized from environment variables');
    
    // Initialize the OIDC client
    return await initializeOIDC();
  } catch (error) {
    logger.error('Error initializing OIDC from environment variables:', error);
    return false;
  }
}

/**
 * Validate an OIDC token
 */
export async function validateOIDCToken(tokenSet: any): Promise<any> {
  try {
    // Get the OIDC configuration
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });
    
    if (!config || !config.enabled) {
      throw new Error('OIDC is not enabled or configured');
    }
    
    // Use the wrapper to validate the token
    const validationResult = await callWrapper('validateToken', {
      clientId: config.clientId || '',
      clientSecret: config.clientSecret || '',
      discoveryUrl: config.discoveryUrl || '',
      tokenSet: JSON.stringify(tokenSet)
    });
    
    if (!validationResult.valid) {
      throw new Error('Token validation failed');
    }
    
    return validationResult.userInfo;
  } catch (error) {
    logger.error('Error validating OIDC token:', error);
    throw error;
  }
} 