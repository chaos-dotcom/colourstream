import axios, { AxiosInstance } from 'axios';

/**
 * Statistics for an OvenMediaEngine entity (virtual host, application, or stream)
 */
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
    createdTime: string;
    lastRecvTime: string;
    lastSentTime: string;
    lastUpdatedTime: string;
    lastThroughputIn: number;
    lastThroughputOut: number;
    maxTotalConnectionTime: string;
    maxTotalConnections: number;
    totalBytesIn: number;
    totalBytesOut: number;
    totalConnections: number;
    avgThroughputIn: number;
    avgThroughputOut: number;
    maxThroughputIn: number;
    maxThroughputOut: number;
}

/**
 * TLS configuration for a virtual host
 */
export interface VirtualHostTLS {
    certPath: string;
    chainCertPath: string;
    keyPath: string;
}

/**
 * Complete configuration for a virtual host
 */
export interface VirtualHostConfig {
    name: string;
    host: {
        names: string[];
        tls?: VirtualHostTLS;
    };
    signedPolicy?: {
        enables: {
            providers: string;
            publishers: string;
        };
        policyQueryKeyName: string;
        secretKey: string;
        signatureQueryKeyName: string;
    };
    admissionWebhooks?: {
        controlServerUrl: string;
        enables: {
            providers: string;
            publishers: string;
        };
        secretKey: string;
        timeout: number;
    };
    origins?: {
        origin: Array<{
            location: string;
            pass: {
                scheme: string;
                urls: {
                    url: string[];
                };
            };
        }>;
    };
    originMapStore?: {
        originHostName: string;
        redisServer: {
            auth: string;
            host: string;
        };
    };
}

/**
 * Output profile configuration for transcoding
 */
export interface OutputProfile {
    name: string;
    outputStreamName?: string;
    encodes: {
        videos?: Array<{
            codec: string;
            width: number;
            height: number;
            bitrate: number;
            framerate: number;
            preset?: string;
        }>;
        audios?: Array<{
            codec: string;
            bitrate: number;
            samplerate: number;
            channel: number;
        }>;
    };
}

/**
 * Configuration for a push target (RTMP or SRT)
 */
export interface PushTarget {
    id?: string;
    url: string;
    streamKey?: string;
    protocol: 'rtmp' | 'srt';
    streamName?: string;
}

/**
 * Configuration for recording streams
 */
export interface RecordingConfig {
    id?: string;
    enabled: boolean;
    filePath: string;
    fileFormat: 'mp4' | 'ts';
    segmentationRule: {
        intervalInSeconds?: number;
        sizeInMb?: number;
    };
}

/**
 * Configuration for a scheduled channel
 */
export interface ScheduledChannel {
    id: string;
    name: string;
    description?: string;
    schedule: {
        startTime: string;
        endTime?: string;
        interval?: number;
        repeatCount?: number;
    };
    items: Array<{
        url: string;
        duration: number;
    }>;
}

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
    statusCode: number;
    message: string;
    response: T;
}

/**
 * OvenMediaEngine REST API client
 * Provides methods to interact with the OvenMediaEngine REST API for reading configuration and statistics
 */
export class OvenMediaEngineApi {
    private client: AxiosInstance;

    /**
     * Creates a new OvenMediaEngine API client
     * @param baseURL - The base URL of the OvenMediaEngine REST API
     * @param accessToken - Access token for authentication
     */
    constructor(baseURL: string, accessToken: string) {
        this.client = axios.create({
            baseURL,
            auth: {
                username: accessToken,
                password: ''
            }
        });
    }

    /**
     * Wraps API calls with error handling
     * @param call - Async function making the API call
     * @returns Promise resolving to the API response
     * @throws Error with appropriate message for different types of API errors
     */
    private async handleApiCall<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new Error('Authentication failed. Please check your access token.');
                } else if (error.response?.status === 404) {
                    throw new Error('Resource not found. Please check your parameters.');
                } else if (error.response?.status === 400) {
                    throw new Error(`Bad request: ${error.response.data?.message || 'Invalid parameters'}`);
                } else if (error.response?.status === 409) {
                    throw new Error(`Conflict: ${error.response.data?.message || 'Resource already exists'}`);
                }
                throw new Error(`API request failed: ${error.response?.data?.message || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Gets statistics for a virtual host
     * @param vhost - Name of the virtual host
     * @returns Statistics for the virtual host
     */
    async getVirtualHostStats(vhost: string): Promise<ApiResponse<OvenStatistics>> {
        return this.handleApiCall(() => this.client.get(`/v1/stats/current/vhosts/${vhost}`).then(r => r.data));
    }

    /**
     * Gets statistics for an application
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @returns Statistics for the application
     */
    async getApplicationStats(vhost: string, app: string): Promise<ApiResponse<OvenStatistics>> {
        return this.handleApiCall(() => this.client.get(`/v1/stats/current/vhosts/${vhost}/apps/${app}`).then(r => r.data));
    }

    /**
     * Gets statistics for a stream
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @param stream - Name of the stream
     * @returns Statistics for the stream
     */
    async getStreamStats(vhost: string, app: string, stream: string): Promise<ApiResponse<OvenStatistics>> {
        return this.handleApiCall(() => this.client.get(`/v1/stats/current/vhosts/${vhost}/apps/${app}/streams/${stream}`).then(r => r.data));
    }

    /**
     * Gets a list of all virtual hosts
     * @returns List of virtual host names
     */
    async getVirtualHosts(): Promise<ApiResponse<string[]>> {
        return this.handleApiCall(() => this.client.get('/v1/vhosts').then(r => r.data));
    }

    /**
     * Gets configuration for a virtual host
     * @param vhost - Name of the virtual host
     * @returns Configuration for the virtual host
     */
    async getVirtualHostConfig(vhost: string): Promise<ApiResponse<VirtualHostConfig>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}`).then(r => r.data));
    }

    /**
     * Gets output profiles for an application
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @returns List of output profiles
     */
    async getOutputProfiles(vhost: string, app: string): Promise<ApiResponse<OutputProfile[]>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/outputProfiles`).then(r => r.data));
    }

    /**
     * Gets a specific output profile
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @param profileName - Name of the output profile
     * @returns Configuration for the output profile
     */
    async getOutputProfile(vhost: string, app: string, profileName: string): Promise<ApiResponse<OutputProfile>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/outputProfiles/${profileName}`).then(r => r.data));
    }

    /**
     * Gets push targets for an application
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @returns List of push targets
     */
    async getPushTargets(vhost: string, app: string): Promise<ApiResponse<PushTarget[]>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/push`).then(r => r.data));
    }

    /**
     * Gets recording configurations for an application
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @returns List of recording configurations
     */
    async getRecordingConfigs(vhost: string, app: string): Promise<ApiResponse<RecordingConfig[]>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/recordings`).then(r => r.data));
    }

    /**
     * Gets scheduled channels for an application
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @returns List of scheduled channels
     */
    async getScheduledChannels(vhost: string, app: string): Promise<ApiResponse<ScheduledChannel[]>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/scheduledChannels`).then(r => r.data));
    }

    /**
     * Gets a specific scheduled channel
     * @param vhost - Name of the virtual host
     * @param app - Name of the application
     * @param channelId - ID of the scheduled channel
     * @returns Configuration for the scheduled channel
     */
    async getScheduledChannel(vhost: string, app: string, channelId: string): Promise<ApiResponse<ScheduledChannel>> {
        return this.handleApiCall(() => this.client.get(`/v1/vhosts/${vhost}/apps/${app}/scheduledChannels/${channelId}`).then(r => r.data));
    }
} 