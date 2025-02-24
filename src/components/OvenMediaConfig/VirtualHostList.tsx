import React, { useEffect, useState } from 'react';
import { OvenMediaEngineApi, VirtualHostConfig } from '../../lib/oven-api';
import { 
    Accordion, 
    AccordionSummary, 
    AccordionDetails,
    Typography,
    Box,
    Chip,
    Grid,
    Paper,
    CircularProgress,
    Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ApplicationList } from './ApplicationList';

/**
 * Props for the VirtualHostList component
 */
interface VirtualHostListProps {
    /** OvenMediaEngine API client instance */
    api: OvenMediaEngineApi;
    /** List of virtual host names */
    vhosts: string[];
}

/**
 * Data structure for virtual host information
 */
interface VHostData {
    /** Virtual host configuration */
    config: VirtualHostConfig;
    /** Virtual host statistics */
    stats: {
        totalConnections: number;
        lastThroughputIn: number;
        lastThroughputOut: number;
    };
}

/**
 * Component for displaying a list of virtual hosts with their configurations and statistics
 * 
 * This component shows each virtual host in an expandable accordion. When expanded,
 * it displays detailed information about the virtual host including:
 * - Host names and TLS configuration
 * - Real-time statistics (connections, throughput)
 * - Applications within the virtual host
 * 
 * The component uses lazy loading to fetch data only when a virtual host is expanded.
 * 
 * @example
 * ```tsx
 * const api = new OvenMediaEngineApi('http://ome-server:3000', 'access-token');
 * const vhosts = ['default', 'streaming'];
 * 
 * function VirtualHosts() {
 *   return <VirtualHostList api={api} vhosts={vhosts} />;
 * }
 * ```
 */
export const VirtualHostList: React.FC<VirtualHostListProps> = ({ api, vhosts }) => {
    const [vhostData, setVhostData] = useState<Record<string, VHostData>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    /**
     * Loads data for a specific virtual host when its accordion is expanded
     * @param vhost - Name of the virtual host to load data for
     */
    const loadVHostData = async (vhost: string) => {
        if (vhostData[vhost]) return;

        setLoading(prev => ({ ...prev, [vhost]: true }));
        try {
            const [configResponse, statsResponse] = await Promise.all([
                api.getVirtualHostConfig(vhost),
                api.getVirtualHostStats(vhost)
            ]);

            setVhostData(prev => ({
                ...prev,
                [vhost]: {
                    config: configResponse.response,
                    stats: {
                        totalConnections: statsResponse.response.totalConnections,
                        lastThroughputIn: statsResponse.response.lastThroughputIn,
                        lastThroughputOut: statsResponse.response.lastThroughputOut
                    }
                }
            }));
            setErrors(prev => ({ ...prev, [vhost]: '' }));
        } catch (err) {
            setErrors(prev => ({ 
                ...prev, 
                [vhost]: err instanceof Error ? err.message : 'Failed to load virtual host data' 
            }));
        } finally {
            setLoading(prev => ({ ...prev, [vhost]: false }));
        }
    };

    /**
     * Formats bytes into a human-readable string with appropriate units
     * @param bytes - Number of bytes to format
     * @returns Formatted string (e.g., "1.5 MB/s")
     */
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}/s`;
    };

    return (
        <Box>
            {vhosts.map(vhost => (
                <Accordion 
                    key={vhost}
                    onChange={(_, expanded) => expanded && loadVHostData(vhost)}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6">{vhost}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {loading[vhost] ? (
                            <Box display="flex" justifyContent="center" p={2}>
                                <CircularProgress />
                            </Box>
                        ) : errors[vhost] ? (
                            <Alert severity="error">{errors[vhost]}</Alert>
                        ) : vhostData[vhost] && (
                            <Box>
                                <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12}>
                                            <Typography variant="subtitle1">Host Names</Typography>
                                            <Box display="flex" gap={1} mt={1}>
                                                {vhostData[vhost].config.host.names.map(name => (
                                                    <Chip key={name} label={name} />
                                                ))}
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Total Connections</Typography>
                                            <Typography>{vhostData[vhost].stats.totalConnections}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Throughput In</Typography>
                                            <Typography>
                                                {formatBytes(vhostData[vhost].stats.lastThroughputIn)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Throughput Out</Typography>
                                            <Typography>
                                                {formatBytes(vhostData[vhost].stats.lastThroughputOut)}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                                <ApplicationList api={api} vhost={vhost} />
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}; 