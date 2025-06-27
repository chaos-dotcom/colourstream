import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger';

interface OvenStatistics {
    connections: {
        file: number;
        hlsv3: number;
        llhls: number;
        ovt: number;
        push: number;
        srt: number;
        thumbnail: number;
        webrtc: number;
    };
    totalConnections: number;
    lastThroughputIn: number;
    lastThroughputOut: number;
}

interface Application {
    name: string;
    type: string;
}

interface ApiResponse<T> {
    statusCode: number;
    message: string;
    response: T;
}

export class OvenMediaEngineService {
    private baseURL: string;
    private accessToken: string;

    constructor() {
        this.baseURL = process.env.OME_API_URL || 'http://origin:8081';
        this.accessToken = process.env.OME_API_ACCESS_TOKEN || '0fc62ea62790ad7c';
        
        logger.info(`Initialized OvenMediaEngine Service with URL: ${this.baseURL}`);
        logger.info(`Using API access token: ${this.accessToken ? '********' : 'default token'}`);
        
        if (!this.baseURL) {
            logger.error('OvenMediaEngine API URL is not configured! Set OME_API_URL environment variable.');
        }
        
        if (!this.accessToken) {
            logger.error('OvenMediaEngine API access token is not configured! Set OME_API_ACCESS_TOKEN environment variable.');
        }
    }

    private validateParameters(...params: string[]) {
        const invalidParams = params.filter(param => !param || typeof param !== 'string');
        if (invalidParams.length > 0) {
            throw new Error(`Invalid parameters provided: ${invalidParams.join(', ')}`);
        }
    }

    private async makeRequest<T>(method: string, path: string, data?: any): Promise<ApiResponse<T>> {
        try {
            // Create Basic auth header
            const basicAuthHeader = 'Basic ' + Buffer.from(this.accessToken).toString('base64');
            
            logger.debug('Making OvenMediaEngine API request:', {
                method,
                url: `${this.baseURL}${path}`,
                headers: {
                    'Authorization': basicAuthHeader
                }
            });

            const response = await axios({
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
        } catch (error) {
            logger.error('OvenMediaEngine API error:', {
                error,
                path,
                method,
                url: `${this.baseURL}${path}`
            });

            if (error instanceof AxiosError) {
                if (error.response?.status === 401) {
                    throw new Error('Authentication failed with OvenMediaEngine API. Please check your access token.');
                }
                if (error.response?.status === 404) {
                    throw new Error(`Resource not found: ${path}`);
                }
                throw new Error(`OvenMediaEngine API error: ${error.response?.data?.message || error.message}`);
            }
            throw new Error('Unknown error occurred while calling OvenMediaEngine API');
        }
    }

    async getVirtualHosts(): Promise<string[]> {
        const response = await this.makeRequest<string[]>('GET', '/v1/vhosts');
        return response.response;
    }

    async getApplications(vhost: string): Promise<Application[]> {
        this.validateParameters(vhost);
        const response = await this.makeRequest<Application[]>('GET', `/v1/vhosts/${encodeURIComponent(vhost)}/apps`);
        return response.response;
    }

    async getVirtualHostStats(vhost: string): Promise<OvenStatistics> {
        this.validateParameters(vhost);
        const response = await this.makeRequest<OvenStatistics>('GET', `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}`);
        return response.response;
    }

    async getApplicationStats(vhost: string, app: string): Promise<OvenStatistics> {
        this.validateParameters(vhost, app);
        const response = await this.makeRequest<OvenStatistics>(
            'GET', 
            `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}/apps/${encodeURIComponent(app)}`
        );
        return response.response;
    }

    async getStreamStats(vhost: string, app: string, stream: string): Promise<OvenStatistics> {
        this.validateParameters(vhost, app, stream);
        const response = await this.makeRequest<OvenStatistics>(
            'GET', 
            `/v1/stats/current/vhosts/${encodeURIComponent(vhost)}/apps/${encodeURIComponent(app)}/streams/${encodeURIComponent(stream)}`
        );
        return response.response;
    }
}

// Create singleton instance for the service
export const omenService = new OvenMediaEngineService(); 
