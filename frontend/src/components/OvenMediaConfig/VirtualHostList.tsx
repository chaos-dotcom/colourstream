import React, { useState, useEffect } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Box,
    CircularProgress,
    Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { OvenMediaEngineApi, OvenStatistics } from '../../lib/oven-api';
import { ApplicationList } from './ApplicationList';

interface VirtualHostListProps {
    api: OvenMediaEngineApi;
}

interface VHostData {
    name: string;
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

export const VirtualHostList: React.FC<VirtualHostListProps> = ({ api }) => {
    const [vhosts, setVhosts] = useState<VHostData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | false>(false);

    useEffect(() => {
        loadVirtualHosts();
    }, []);

    const loadVirtualHosts = async () => {
        try {
            const names = await api.getVirtualHosts();
            setVhosts(names.map(name => ({ name, loading: false })));
            setError(null);
        } catch (err) {
            setError('Failed to load virtual hosts');
            console.error('Error loading virtual hosts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccordionChange = (vhost: string) => async (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? vhost : false);
        
        if (isExpanded) {
            const vhostIndex = vhosts.findIndex(v => v.name === vhost);
            if (vhostIndex === -1 || vhosts[vhostIndex].stats) return;

            setVhosts(prev => prev.map(v => 
                v.name === vhost ? { ...v, loading: true } : v
            ));

            try {
                const stats = await api.getVirtualHostStats(vhost);
                setVhosts(prev => prev.map(v => 
                    v.name === vhost ? { ...v, stats, loading: false } : v
                ));
            } catch (err) {
                setVhosts(prev => prev.map(v => 
                    v.name === vhost ? { ...v, error: 'Failed to load statistics', loading: false } : v
                ));
                console.error(`Error loading stats for ${vhost}:`, err);
            }
        }
    };

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box>
            {vhosts.map(vhost => (
                <Accordion
                    key={vhost.name}
                    expanded={expanded === vhost.name}
                    onChange={handleAccordionChange(vhost.name)}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            {vhost.name}
                        </Typography>
                        {vhost.loading ? (
                            <CircularProgress size={20} />
                        ) : vhost.stats ? (
                            <Typography sx={{ color: 'text.secondary' }}>
                                Connections: {vhost.stats.totalConnections} | 
                                Throughput In: {formatBytes(vhost.stats.lastThroughputIn)}/s | 
                                Out: {formatBytes(vhost.stats.lastThroughputOut)}/s
                            </Typography>
                        ) : null}
                    </AccordionSummary>
                    <AccordionDetails>
                        {vhost.error ? (
                            <Alert severity="error">{vhost.error}</Alert>
                        ) : (
                            <ApplicationList api={api} vhost={vhost.name} />
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}; 