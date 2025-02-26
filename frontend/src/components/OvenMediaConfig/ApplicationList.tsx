import React, { useState, useEffect } from 'react';
import {
    Box,
    CircularProgress,
    Alert,
    Chip,
} from '@mui/material';
import { OvenMediaEngineApi, OvenStatistics } from '../../lib/oven-api';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../GovUkComponents';

interface ApplicationListProps {
    api: OvenMediaEngineApi;
    vhost: string;
}

interface AppData {
    name: string;
    type: string;
    stats?: OvenStatistics;
    error?: string;
    loading: boolean;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const ApplicationList: React.FC<ApplicationListProps> = ({ api, vhost }) => {
    const [apps, setApps] = useState<AppData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadApplications();
    }, [vhost]);

    const loadApplications = async () => {
        try {
            setLoading(true);
            const applications = await api.getApplications(vhost);
            console.log('Received applications:', applications);
            
            // Ensure each application has the correct structure
            const formattedApps = applications.map(app => ({
                name: typeof app === 'string' ? app : app.name,
                type: typeof app === 'string' ? 'default' : (app.type || 'default'),
                loading: true
            }));
            
            setApps(formattedApps);
            
            // Load stats for all applications in parallel
            const statsPromises = formattedApps.map(async (app) => {
                try {
                    const stats = await api.getApplicationStats(vhost, app.name);
                    return { ...app, stats, loading: false };
                } catch (err: any) {
                    console.error(`Error loading stats for ${app.name}:`, err);
                    const errorMessage = err.response?.data?.message || err.message || 'Failed to load statistics';
                    return { ...app, error: errorMessage, loading: false };
                }
            });
            
            const appsWithStats = await Promise.all(statsPromises);
            setApps(appsWithStats);
            setError(null);
        } catch (err) {
            setError('Failed to load applications');
            console.error('Error loading applications:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading && apps.length === 0) {
        return <CircularProgress />;
    }

    if (error && apps.length === 0) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box sx={{ border: '1px solid #b1b4b6', mb: 3 }}>
            <Box sx={{ p: 2, backgroundColor: '#f3f2f1', borderBottom: '1px solid #b1b4b6' }}>
                <Box sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
                    {vhost} Applications
                </Box>
            </Box>
            
            <Box sx={{ p: 2 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell header>Application</TableCell>
                            <TableCell header>Type</TableCell>
                            <TableCell header>Connections</TableCell>
                            <TableCell header>Throughput In/Out</TableCell>
                            <TableCell header>Connection Types</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {apps.map(app => (
                            <TableRow key={app.name}>
                                <TableCell>
                                    <Box sx={{ fontWeight: 600 }}>
                                        {app.name}
                                    </Box>
                                </TableCell>
                                <TableCell>{app.type}</TableCell>
                                <TableCell>
                                    {app.loading ? (
                                        <CircularProgress size={20} />
                                    ) : app.error ? (
                                        <Box sx={{ color: '#d4351c' }}>Error</Box>
                                    ) : app.stats ? (
                                        app.stats.totalConnections
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {app.loading ? (
                                        <CircularProgress size={20} />
                                    ) : app.error ? (
                                        <Box sx={{ color: '#d4351c' }}>Error</Box>
                                    ) : app.stats ? (
                                        <Box>
                                            <Box>In: {formatBytes(app.stats.lastThroughputIn)}/s</Box>
                                            <Box>Out: {formatBytes(app.stats.lastThroughputOut)}/s</Box>
                                        </Box>
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {app.loading ? (
                                        <CircularProgress size={20} />
                                    ) : app.error ? (
                                        <Box sx={{ color: '#d4351c' }}>Error</Box>
                                    ) : app.stats ? (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {Object.entries(app.stats.connections).map(([type, count]) => (
                                                count > 0 && (
                                                    <Chip 
                                                        key={`${app.name}-${type}`}
                                                        label={`${type}: ${count}`}
                                                        size="small"
                                                        sx={{ 
                                                            backgroundColor: '#1d70b8', 
                                                            color: 'white',
                                                            fontWeight: 600
                                                        }}
                                                    />
                                                )
                                            ))}
                                            {Object.values(app.stats.connections).every(count => count === 0) && (
                                                <Box sx={{ color: '#505a5f' }}>No active connections</Box>
                                            )}
                                        </Box>
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                
                {apps.map(app => app.error && (
                    <Alert severity="error" sx={{ mt: 2 }} key={`${app.name}-error`}>
                        Error loading stats for {app.name}: {app.error}
                    </Alert>
                ))}
            </Box>
        </Box>
    );
}; 