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

interface ApiResponse<T> {
    statusCode: number;
    message: string;
    response: T;
}

class OvenMediaEngineService {
    private baseURL: string;
    private accessToken: string;

    constructor() {
        this.baseURL = process.env.OVENMEDIA_API_URL || 'http://origin:8081';
        this.accessToken = process.env.OVENMEDIA_API_TOKEN || '0fc62ea62790ad7c';
        
        logger.info(`Initialized OvenMediaEngine Service with URL: ${this.baseURL}`);
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
            logger.error('OvenMediaEngine API error:', error);
            if (error instanceof AxiosError) {
                if (error.response?.status === 401) {
                    throw new Error('Authentication failed with OvenMediaEngine API. Please check your access token.');
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

    async getVirtualHostStats(vhost: string): Promise<OvenStatistics> {
        const response = await this.makeRequest<OvenStatistics>('GET', `/v1/stats/current/vhosts/${vhost}`);
        return response.response;
    }

    async getApplicationStats(vhost: string, app: string): Promise<OvenStatistics> {
        const response = await this.makeRequest<OvenStatistics>('GET', `/v1/stats/current/vhosts/${vhost}/apps/${app}`);
        return response.response;
    }

    async getStreamStats(vhost: string, app: string, stream: string): Promise<OvenStatistics> {
        const response = await this.makeRequest<OvenStatistics>(
            'GET', 
            `/v1/stats/current/vhosts/${vhost}/apps/${app}/streams/${stream}`
        );
        return response.response;
    }
}

export const omenService = new OvenMediaEngineService(); 