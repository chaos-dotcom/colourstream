import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// We'll use a different approach for ESM modules
const prisma = new PrismaClient();
let oidcClient: any = null;
let openidClientModule: any = null;
const stateMap = new Map<string, { nonce: string, redirectUrl?: string }>();

// Function to dynamically load the openid-client module
async function loadOpenidClient() {
  if (openidClientModule) return openidClientModule;
  
  try {
    // Use dynamic import with await
    const module = await import('openid-client');
    openidClientModule = module;
    logger.info('OpenID Client module loaded successfully');
    return module;
  } catch (error) {
    logger.error('Failed to load OpenID Client module:', error);
    throw error;
  }
}

/**
 * Initialize OIDC client based on configuration in the database
 */
export async function initializeOIDC(): Promise<boolean> {
  try {
    // Load the openid-client module
    const openidClient = await loadOpenidClient();
    
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

    // If discovery URL is provided, use it to discover endpoints
    if (config.discoveryUrl) {
      try {
        const issuer = await openidClient.Issuer.discover(config.discoveryUrl);
        logger.info(`Discovered issuer ${issuer.issuer}`);

        oidcClient = new issuer.Client({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uris: [config.redirectUri || ''],
          response_types: ['code'],
        });

        logger.info('OIDC client initialized successfully using discovery URL');
        return true;
      } catch (error) {
        logger.error('Error discovering OIDC issuer:', error);
        return false;
      }
    } 
    // If no discovery URL, use manual configuration
    else if (config.authorizationUrl && config.tokenUrl) {
      try {
        const issuer = new openidClient.Issuer({
          issuer: config.providerName,
          authorization_endpoint: config.authorizationUrl,
          token_endpoint: config.tokenUrl,
          userinfo_endpoint: config.userInfoUrl,
          jwks_uri: '',
        });

        oidcClient = new issuer.Client({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uris: [config.redirectUri || ''],
          response_types: ['code'],
        });

        logger.info('OIDC client initialized successfully using manual configuration');
        return true;
      } catch (error) {
        logger.error('Error creating OIDC client with manual configuration:', error);
        return false;
      }
    } else {
      logger.error('Insufficient OIDC configuration: missing discovery URL or manual endpoints');
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
        isInitialized: !!oidcClient,
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
      isInitialized: !!oidcClient,
    };
  } catch (error) {
    logger.error('Error updating OIDC config:', error);
    throw error;
  }
}

/**
 * Generate authorization URL for OIDC login
 */
export async function getAuthorizationUrl(state?: string) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized');
  }

  // Load the openid-client module
  const openidClient = await loadOpenidClient();

  const nonce = openidClient.generators.nonce();
  const codeVerifier = openidClient.generators.codeVerifier();
  const codeChallenge = openidClient.generators.codeChallenge(codeVerifier);

  // Store these values in session or database
  // For this example, we'll return them to be stored client-side
  // In production, these should be stored securely server-side
  
  return {
    url: oidcClient.authorizationUrl({
      scope: 'openid profile email',
      response_type: 'code',
      nonce,
      state: state || openidClient.generators.state(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }),
    codeVerifier,
    nonce,
  };
}

/**
 * Handle OIDC callback and token exchange
 */
export async function handleCallback(callbackParams: any, codeVerifier: string) {
  if (!oidcClient) {
    throw new Error('OIDC client not initialized');
  }

  try {
    const tokenSet = await oidcClient.callback(
      callbackParams.redirect_uri || oidcClient.redirect_uris[0],
      callbackParams,
      { code_verifier: codeVerifier }
    );

    // Get user info
    const userInfo = await oidcClient.userinfo(tokenSet);

    return {
      tokenSet,
      userInfo,
    };
  } catch (error) {
    logger.error('Error handling OIDC callback:', error);
    throw error;
  }
}

export function isOIDCInitialized(): boolean {
  return oidcClient !== null;
}

export function getRedirectUrlFromState(state: string): string | undefined {
  return stateMap.get(state)?.redirectUrl;
} 