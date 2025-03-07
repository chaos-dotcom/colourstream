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
exports.omenService = void 0;
const axios_1 = __importStar(require("axios"));
const logger_1 = require("../utils/logger");
class OvenMediaEngineService {
    constructor() {
        this.baseURL = process.env.OME_API_URL || 'http://origin:8081';
        this.accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
        
        logger_1.logger.info(`Initialized OvenMediaEngine Service with URL: ${this.baseURL}`);
        logger_1.logger.info(`Using API access token: ${this.accessToken ? '********' : 'default token'}`);
        
        if (!this.baseURL) {
            logger_1.logger.error('OvenMediaEngine API URL is not configured! Set OME_API_URL environment variable.');
        }
        
        if (!this.accessToken) {
            logger_1.logger.error('OvenMediaEngine API access token is not configured! Set OME_API_ACCESS_TOKEN environment variable.');
        }
    }
    validateParameters(...params) {
        const invalidParams = params.filter(param => !param || typeof param !== 'string');
        if (invalidParams.length > 0) {
            throw new Error(`Invalid parameters provided: ${invalidParams.join(', ')}`);
        }
    }
    async makeRequest(method, path, data) {
        var _a, _b, _c, _d;
        try {
            // Create Basic auth header
            const basicAuthHeader = 'Basic ' + Buffer.from(this.accessToken).toString('base64');
            logger_1.logger.debug('Making OvenMediaEngine API request:', {
                method,
                url: `${this.baseURL}${path}`,
                headers: {
                    'Authorization': basicAuthHeader
                }
            });
            const response = await (0, axios_1.default)({
                method,
                url: `${this.baseURL}${path}`,
                data,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': basicAuthHeader
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('OvenMediaEngine API error:', {
                error,
                path,
                method,
                url: `${this.baseURL}${path}`
            });
            if (error instanceof axios_1.AxiosError) {
                if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                    throw new Error('Authentication failed with OvenMediaEngine API. Please check your access token.');
                }
                if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
                    throw new Error(`Resource not found: ${path}`);
                }
                throw new Error(`OvenMediaEngine API error: ${((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message}`);
            }
            throw new Error('Unknown error occurred while calling OvenMediaEngine API');
        }
    }
    async getVirtualHosts() {
        const response = await this.makeRequest('GET', '/v1/vhosts');
        return response.response;
    }
    async getApplications(vhost) {
        this.validateParameters(vhost);
        const response = await this.makeRequest('GET', `/v1/vhosts/${encodeURIComponent(vhost)}/apps`);
        return response.response;
    }
    async getVirtualHostStats(vhost) {
        this.validateParameters(vhost);
        const response = await this.makeRequest('GET', `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}`);
        return response.response;
    }
    async getApplicationStats(vhost, app) {
        this.validateParameters(vhost, app);
        const response = await this.makeRequest('GET', `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}/apps/${encodeURIComponent(app)}`);
        return response.response;
    }
    async getStreamStats(vhost, app, stream) {
        this.validateParameters(vhost, app, stream);
        const response = await this.makeRequest('GET', `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}/apps/${encodeURIComponent(app)}/streams/${encodeURIComponent(stream)}`);
        return response.response;
    }
}
exports.omenService = new OvenMediaEngineService();
