import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as child_process from 'child_process';

// We'll use a different approach for ESM modules
const prisma = new PrismaClient();
const stateMap = new Map<string, { nonce: string, redirectUrl?: string, codeVerifier?: string }>();

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
    return await response.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error calling wrapper: ${errorMessage}`);
    throw error;
  }
};

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
export async function getAuthorizationUrl(redirectUrl?: string) {
  try {
    // Get the OIDC configuration
    const config = await (prisma as any).OIDCConfig.findUnique({
      where: { id: 'default' },
    });
    
    if (!config || !config.enabled) {
      throw new Error('OIDC is not enabled or configured');
    }
    
    // Generate the necessary values
    const { nonce, state, codeVerifier, codeChallenge } = await callWrapper('generate');
    
    // Store the redirect URL with the state
    if (redirectUrl) {
      stateMap.set(state, { nonce, redirectUrl, codeVerifier });
    } else {
      stateMap.set(state, { nonce, codeVerifier });
    }
    
    // Construct the authorization URL
    let authUrl = '';
    
    if (config.discoveryUrl) {
      // Discover the endpoints
      const issuerInfo = await callWrapper('discover', { url: config.discoveryUrl });
      
      // Construct the authorization URL
      authUrl = `${issuerInfo.authorization_endpoint}?` + 
        `client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri || '')}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(config.scope || 'openid profile email')}` +
        `&state=${encodeURIComponent(state)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256`;
    } else if (config.authorizationUrl) {
      // Use the manually configured authorization URL
      authUrl = `${config.authorizationUrl}?` + 
        `client_id=${encodeURIComponent(config.clientId)}` +
        `&redirect_uri=${encodeURIComponent(config.redirectUri || '')}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(config.scope || 'openid profile email')}` +
        `&state=${encodeURIComponent(state)}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256`;
    } else {
      throw new Error('No authorization URL available');
    }
    
    return {
      url: authUrl,
      codeVerifier,
      nonce,
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
    
    // Get the stored data for this state
    const storedData = stateMap.get(state);
    if (!storedData) {
      throw new Error('Invalid state parameter');
    }
    
    logger.info(`Processing OIDC callback with code: ${code.substring(0, 10)}...`);
    
    try {
      // Discover the OIDC provider endpoints
      const issuerInfo = await callWrapper('discover', { url: config.discoveryUrl });
      
      // Create parameters for token exchange
      const tokenParams: Record<string, string> = {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri
      };
      
      // Only add code_verifier if it exists
      if (storedData.codeVerifier) {
        tokenParams.code_verifier = storedData.codeVerifier;
      }
      
      // Exchange the authorization code for tokens
      const tokenResponse = await fetch(issuerInfo.token_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams),
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        logger.error(`Token exchange failed: ${errorData}`);
        throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status}`);
      }
      
      const tokenSet = await tokenResponse.json();
      
      // Get user information using the access token
      const userInfoResponse = await fetch(issuerInfo.userinfo_endpoint, {
        headers: {
          'Authorization': `Bearer ${tokenSet.access_token}`
        }
      });
      
      if (!userInfoResponse.ok) {
        throw new Error(`Failed to get user info: ${userInfoResponse.status}`);
      }
      
      const userInfo = await userInfoResponse.json();
      
      // Check if a specific group is required
      if (config.group) {
        logger.info(`OIDC group check required: ${config.group}`);
        
        // Check if user belongs to the required group
        // The exact property to check depends on your OIDC provider's response format
        // Common properties are groups, roles, or custom claims
        const userGroups = userInfo.groups || userInfo.roles || [];
        
        // Convert to array if it's a string
        const groupsArray = Array.isArray(userGroups) ? userGroups : [userGroups];
        
        if (!groupsArray.includes(config.group)) {
          logger.warn(`User ${userInfo.sub} does not belong to required group ${config.group}`);
          throw new Error(`Access denied: User does not belong to required group ${config.group}`);
        }
        
        logger.info(`User ${userInfo.sub} belongs to required group ${config.group}`);
      }
      
      // Clean up the state map
      stateMap.delete(state);
      
      return {
        tokenSet,
        userInfo,
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