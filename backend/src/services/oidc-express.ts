import { auth, ConfigParams } from 'express-openid-connect';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { Express } from 'express';

const prisma = new PrismaClient();

// Default configuration
let oidcConfig: ConfigParams = {
  authRequired: false,
  auth0Logout: false,
  idpLogout: true,
  secret: process.env.ADMIN_AUTH_SECRET || 'a-long-random-string',
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  clientID: process.env.OIDC_CLIENT_ID || '',
  issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  routes: {
    login: '/api/auth/oidc/login',
    callback: '/api/auth/oidc/callback',
    logout: '/api/auth/logout'
  },
  authorizationParams: {
    response_type: 'code',
    scope: 'openid profile email'
  }
};

/**
 * Initialize OIDC from environment variables
 */
export async function initializeOIDCFromEnv(): Promise<boolean> {
  try {
    // Check if environment variables are set
    if (
      process.env.OIDC_ISSUER_BASE_URL &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_CLIENT_SECRET
    ) {
      logger.info('Initializing OIDC from environment variables');
      
      oidcConfig = {
        ...oidcConfig,
        issuerBaseURL: process.env.OIDC_ISSUER_BASE_URL,
        clientID: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        baseURL: process.env.BASE_URL || oidcConfig.baseURL,
      };
      
      // Update the database config to match environment variables
      await updateOIDCConfigInDB({
        enabled: true,
        providerName: 'Environment',
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        discoveryUrl: process.env.OIDC_ISSUER_BASE_URL,
        scope: process.env.OIDC_SCOPE || 'openid profile email'
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error initializing OIDC from environment:', error);
    return false;
  }
}

/**
 * Initialize OIDC from database configuration
 */
export async function initializeOIDCFromDB(): Promise<boolean> {
  try {
    // Get config from database
    const config = await prisma.oIDCConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config || !config.enabled) {
      logger.info('OIDC is not enabled or configured in database');
      return false;
    }

    if (!config.clientId || !config.clientSecret || !config.discoveryUrl) {
      logger.error('OIDC client ID, secret, or discovery URL is missing');
      return false;
    }

    // Update the config
    oidcConfig = {
      ...oidcConfig,
      issuerBaseURL: config.discoveryUrl,
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      authorizationParams: {
        ...oidcConfig.authorizationParams,
        scope: config.scope || 'openid profile email'
      }
    };

    logger.info('OIDC initialized from database configuration');
    return true;
  } catch (error) {
    logger.error('Error initializing OIDC from database:', error);
    return false;
  }
}

/**
 * Update OIDC configuration in the database
 */
export async function updateOIDCConfigInDB(configData: any) {
  try {
    const updatedConfig = await prisma.oIDCConfig.upsert({
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

    // Reinitialize OIDC with new config
    await initializeOIDCFromDB();

    // Return config without client secret
    const { clientSecret, ...safeConfig } = updatedConfig;
    return {
      config: safeConfig,
      isInitialized: true,
    };
  } catch (error) {
    logger.error('Error updating OIDC config:', error);
    throw error;
  }
}

/**
 * Get the current OIDC configuration
 */
export async function getOIDCConfig() {
  try {
    const config = await prisma.oIDCConfig.findUnique({
      where: { id: 'default' },
    });

    // Return config without client secret
    if (config) {
      const { clientSecret, ...safeConfig } = config;
      return {
        config: safeConfig,
        isInitialized: true,
      };
    }

    // If no config exists, create a default one
    const defaultConfig = await prisma.oIDCConfig.create({
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
 * Initialize the Express app with OIDC middleware
 */
export function initializeOIDCMiddleware(app: Express): void {
  // Check if we have a valid configuration before initializing
  if (!oidcConfig.issuerBaseURL) {
    logger.warn('OIDC middleware not initialized: issuerBaseURL is empty');
    return;
  }
  
  if (!oidcConfig.clientID) {
    logger.warn('OIDC middleware not initialized: clientID is empty');
    return;
  }
  
  if (!oidcConfig.clientSecret) {
    logger.warn('OIDC middleware not initialized: clientSecret is empty');
    return;
  }
  
  // Initialize OIDC middleware with current config
  app.use(auth(oidcConfig));
  
  logger.info('OIDC middleware initialized with current configuration');
}

/**
 * Initialize OIDC
 * This should be called at application startup
 */
export async function initializeOIDC(): Promise<boolean> {
  // First try to initialize from environment variables
  const envInitialized = await initializeOIDCFromEnv();
  
  // If that fails, try to initialize from database
  if (!envInitialized) {
    return await initializeOIDCFromDB();
  }
  
  return envInitialized;
} 