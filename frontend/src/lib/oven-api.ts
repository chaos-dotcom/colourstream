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

export interface Application {
    name: string;
    type: string;
}

export class OvenMediaEngineApi {
    private validateParams(...params: (string | undefined)[]) {
        const invalidParams = params.filter(param => !param || typeof param !== 'string');
        if (invalidParams.length > 0) {
            throw new Error('Invalid or missing parameters');
        }
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

    async getApplications(vhost: string): Promise<Application[]> {
        try {
            this.validateParams(vhost);
            const encodedVhost = encodeURIComponent(vhost);
            console.log('Getting applications for vhost:', { vhost, encodedVhost });
            
            const response = await api.get(`/omen/vhosts/${encodedVhost}/apps`);
            console.log('Received applications response:', response.data);
            
            // Handle both string array and object array responses
            const applications = response.data.data.applications;
            return applications.map((app: string | Application) => {
                if (typeof app === 'string') {
                    return { name: app, type: 'default' };
                }
                return app;
            });
        } catch (error: any) {
            console.error('Error fetching applications:', {
                vhost,
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getVirtualHostStats(vhost: string): Promise<OvenStatistics> {
        this.validateParams(vhost);
        const encodedVhost = encodeURIComponent(vhost);
        const response = await api.get(`/omen/vhosts/${encodedVhost}/stats`);
        return response.data.data.stats;
    }

    async getApplicationStats(vhost: string, app: string): Promise<OvenStatistics> {
        try {
            this.validateParams(vhost, app);
            const encodedVhost = encodeURIComponent(vhost);
            const encodedApp = encodeURIComponent(app);
            
            console.log('Making application stats request:', {
                vhost,
                app,
                encodedVhost,
                encodedApp,
                url: `/omen/vhosts/${encodedVhost}/apps/${encodedApp}/stats`
            });

            const response = await api.get(`/omen/vhosts/${encodedVhost}/apps/${encodedApp}/stats`);
            
            console.log('Received application stats response:', {
                status: response.status,
                data: response.data
            });

            return response.data.data.stats;
        } catch (error: any) {
            console.error('Error fetching application stats:', {
                vhost,
                app,
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getStreamStats(vhost: string, app: string, stream: string): Promise<OvenStatistics> {
        try {
            this.validateParams(vhost, app, stream);
            const encodedVhost = encodeURIComponent(vhost);
            const encodedApp = encodeURIComponent(app);
            const encodedStream = encodeURIComponent(stream);
            const response = await api.get(
                `/omen/vhosts/${encodedVhost}/apps/${encodedApp}/streams/${encodedStream}/stats`
            );
            return response.data.data.stats;
        } catch (error: any) {
            console.error('Error fetching stream stats:', {
                vhost,
                app,
                stream,
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers
            });
            throw error;
        }
    }
} 