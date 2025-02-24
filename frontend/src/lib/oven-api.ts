import { api } from '../utils/api';

export interface OvenStatistics {
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

export class OvenMediaEngineApi {
    constructor() {
        // No need for baseURL as we're using the api instance
    }

    async getVirtualHosts(): Promise<string[]> {
        try {
            const response = await api.get('/omen/vhosts');
            return response.data.data.vhosts;
        } catch (error: any) {
            console.error('Error fetching virtual hosts:', {
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers
            });
            throw error;
        }
    }

    async getVirtualHostStats(vhost: string): Promise<OvenStatistics> {
        const response = await api.get(`/omen/vhosts/${vhost}/stats`);
        return response.data.data.stats;
    }

    async getApplicationStats(vhost: string, app: string): Promise<OvenStatistics> {
        const response = await api.get(`/omen/vhosts/${vhost}/apps/${app}/stats`);
        return response.data.data.stats;
    }

    async getStreamStats(vhost: string, app: string, stream: string): Promise<OvenStatistics> {
        const response = await api.get(`/omen/vhosts/${vhost}/apps/${app}/streams/${stream}/stats`);
        return response.data.data.stats;
    }
} 