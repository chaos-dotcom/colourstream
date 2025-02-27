"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOIDC = initializeOIDC;
exports.getOIDCConfig = getOIDCConfig;
exports.updateOIDCConfig = updateOIDCConfig;
exports.getAuthorizationUrl = getAuthorizationUrl;
exports.handleCallback = handleCallback;
exports.isOIDCInitialized = isOIDCInitialized;
exports.getRedirectUrlFromState = getRedirectUrlFromState;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
// We'll use a different approach for ESM modules
const prisma = new client_1.PrismaClient();
let oidcClient = null;
let openidClientModule = null;
const stateMap = new Map();
// Function to dynamically load the openid-client module
async function loadOpenidClient() {
    if (openidClientModule)
        return openidClientModule;
    try {
        // Use dynamic import with await
        const module = await Promise.resolve().then(() => __importStar(require('openid-client')));
        openidClientModule = module;
        logger_1.logger.info('OpenID Client module loaded successfully');
        return module;
    }
    catch (error) {
        logger_1.logger.error('Failed to load OpenID Client module:', error);
        throw error;
    }
}
/**
 * Initialize OIDC client based on configuration in the database
 */
async function initializeOIDC() {
    try {
        // Load the openid-client module
        const openidClient = await loadOpenidClient();
        // Use type assertion to avoid TypeScript errors
        const config = await prisma.OIDCConfig.findUnique({
            where: { id: 'default' },
        });
        if (!config || !config.enabled) {
            logger_1.logger.info('OIDC is not enabled or configured');
            return false;
        }
        if (!config.clientId || !config.clientSecret) {
            logger_1.logger.error('OIDC client ID or secret is missing');
            return false;
        }
        // If discovery URL is provided, use it to discover endpoints
        if (config.discoveryUrl) {
            try {
                const issuer = await openidClient.Issuer.discover(config.discoveryUrl);
                logger_1.logger.info(`Discovered issuer ${issuer.issuer}`);
                oidcClient = new issuer.Client({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    redirect_uris: [config.redirectUri || ''],
                    response_types: ['code'],
                });
                logger_1.logger.info('OIDC client initialized successfully using discovery URL');
                return true;
            }
            catch (error) {
                logger_1.logger.error('Error discovering OIDC issuer:', error);
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
                logger_1.logger.info('OIDC client initialized successfully using manual configuration');
                return true;
            }
            catch (error) {
                logger_1.logger.error('Error creating OIDC client with manual configuration:', error);
                return false;
            }
        }
        else {
            logger_1.logger.error('Insufficient OIDC configuration: missing discovery URL or manual endpoints');
            return false;
        }
    }
    catch (error) {
        logger_1.logger.error('Error initializing OIDC client:', error);
        return false;
    }
}
/**
 * Get the current OIDC configuration
 */
async function getOIDCConfig() {
    try {
        // Use type assertion to avoid TypeScript errors
        const config = await prisma.OIDCConfig.findUnique({
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
        const defaultConfig = await prisma.OIDCConfig.create({
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
    }
    catch (error) {
        logger_1.logger.error('Error getting OIDC config:', error);
        throw error;
    }
}
/**
 * Update OIDC configuration
 */
async function updateOIDCConfig(configData) {
    try {
        // Use type assertion to avoid TypeScript errors
        const updatedConfig = await prisma.OIDCConfig.upsert({
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
    }
    catch (error) {
        logger_1.logger.error('Error updating OIDC config:', error);
        throw error;
    }
}
/**
 * Generate authorization URL for OIDC login
 */
async function getAuthorizationUrl(state) {
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
async function handleCallback(callbackParams, codeVerifier) {
    if (!oidcClient) {
        throw new Error('OIDC client not initialized');
    }
    try {
        const tokenSet = await oidcClient.callback(callbackParams.redirect_uri || oidcClient.redirect_uris[0], callbackParams, { code_verifier: codeVerifier });
        // Get user info
        const userInfo = await oidcClient.userinfo(tokenSet);
        return {
            tokenSet,
            userInfo,
        };
    }
    catch (error) {
        logger_1.logger.error('Error handling OIDC callback:', error);
        throw error;
    }
}
function isOIDCInitialized() {
    return oidcClient !== null;
}
function getRedirectUrlFromState(state) {
    var _a;
    return (_a = stateMap.get(state)) === null || _a === void 0 ? void 0 : _a.redirectUrl;
}
