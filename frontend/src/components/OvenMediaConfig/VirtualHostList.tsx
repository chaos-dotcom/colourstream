import React, { useState, useEffect } from 'react';
import {
    Box,
    CircularProgress,
    Alert,
    Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { OvenMediaEngineApi, OvenStatistics } from '../../lib/oven-api';
import { ApplicationList } from './ApplicationList';
import { 
    SectionHeading, 
    Button, 
    Table, 
    TableHead, 
    TableBody, 
    TableRow, 
    TableCell 
} from '../GovUkComponents';

interface VirtualHostListProps {
    api: OvenMediaEngineApi;
}

interface VHostData {
    name: string;
    stats?: OvenStatistics;
    error?: string;
    loading: boolean;
    showApplications: boolean;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const VirtualHostList: React.FC<VirtualHostListProps> = ({ api }) => {
    const [vhosts, setVhosts] = useState<VHostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadVirtualHosts();
    }, []);

    const loadVirtualHosts = async () => {
        try {
            setLoading(true);
            const names = await api.getVirtualHosts();
            
            // Initialize vhosts with loading state
            const initialVhosts = names.map(name => ({ 
                name, 
                loading: true,
                showApplications: true // Show all applications by default
            }));
            setVhosts(initialVhosts);
            
            // Load stats for all vhosts in parallel
            const statsPromises = names.map(async (name) => {
                try {
                    const stats = await api.getVirtualHostStats(name);
                    return { name, stats, loading: false, showApplications: true };
                } catch (err) {
                    console.error(`Error loading stats for ${name}:`, err);
                    return { name, error: 'Failed to load statistics', loading: false, showApplications: true };
                }
            });
            
            const vhostsWithStats = await Promise.all(statsPromises);
            setVhosts(vhostsWithStats);
            setError(null);
        } catch (err) {
            setError('Failed to load virtual hosts');
            console.error('Error loading virtual hosts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadVirtualHosts();
    };

    if (loading && vhosts.length === 0) {
        return <CircularProgress />;
    }

    if (error && vhosts.length === 0) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <SectionHeading>Virtual Hosts</SectionHeading>
                <Button 
                    onClick={handleRefresh}
                    variant="primary"
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RefreshIcon fontSize="small" />
                        Refresh
                    </Box>
                </Button>
            </Box>
            
            <Box sx={{ border: '1px solid #b1b4b6', mb: 4 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell header>Virtual Host</TableCell>
                            <TableCell header>Connections</TableCell>
                            <TableCell header>Throughput In</TableCell>
                            <TableCell header>Throughput Out</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {vhosts.map(vhost => (
                            <TableRow key={vhost.name}>
                                <TableCell>
                                    <Box sx={{ fontWeight: 600 }}>
                                        {vhost.name}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    {vhost.loading ? (
                                        <CircularProgress size={20} />
                                    ) : vhost.stats ? (
                                        vhost.stats.totalConnections
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {vhost.loading ? (
                                        <CircularProgress size={20} />
                                    ) : vhost.stats ? (
                                        `${formatBytes(vhost.stats.lastThroughputIn)}/s`
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {vhost.loading ? (
                                        <CircularProgress size={20} />
                                    ) : vhost.stats ? (
                                        `${formatBytes(vhost.stats.lastThroughputOut)}/s`
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
            
            <SectionHeading>Applications</SectionHeading>
            
            <Grid container spacing={3}>
                {vhosts.map(vhost => (
                    !vhost.error ? (
                        <Grid item xs={12} key={vhost.name}>
                            <ApplicationList api={api} vhost={vhost.name} />
                        </Grid>
                    ) : (
                        <Grid item xs={12} key={vhost.name}>
                            <Alert severity="error">
                                Error loading applications for {vhost.name}: {vhost.error}
                            </Alert>
                        </Grid>
                    )
                ))}
            </Grid>
        </Box>
    );
}; 