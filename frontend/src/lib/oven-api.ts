import axios from 'axios';

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
    private baseURL: string;

    constructor() {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
        this.baseURL = `${apiUrl}/omen`;
    }

    async getVirtualHosts(): Promise<string[]> {
        const response = await axios.get(`${this.baseURL}/vhosts`);
        return response.data.data.vhosts;
    }

    async getVirtualHostStats(vhost: string): Promise<OvenStatistics> {
        const response = await axios.get(`${this.baseURL}/vhosts/${vhost}/stats`);
        return response.data.data.stats;
    }

    async getApplicationStats(vhost: string, app: string): Promise<OvenStatistics> {
        const response = await axios.get(`${this.baseURL}/vhosts/${vhost}/apps/${app}/stats`);
        return response.data.data.stats;
    }

    async getStreamStats(vhost: string, app: string, stream: string): Promise<OvenStatistics> {
        const response = await axios.get(`${this.baseURL}/vhosts/${vhost}/apps/${app}/streams/${stream}/stats`);
        return response.data.data.stats;
    }
} 