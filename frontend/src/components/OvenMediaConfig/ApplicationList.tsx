import React, { useState, useEffect } from 'react';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Box,
    CircularProgress,
    Alert,
    Tabs,
    Tab,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { OvenMediaEngineApi, OvenStatistics } from '../../lib/oven-api';

interface ApplicationListProps {
    api: OvenMediaEngineApi;
    vhost: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

interface AppData {
    name: string;
    stats?: OvenStatistics;
    error?: string;
    loading: boolean;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
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
    const [expanded, setExpanded] = useState<string | false>(false);
    const [tabValue, setTabValue] = useState(0);

    useEffect(() => {
        loadApplications();
    }, [vhost]);

    const loadApplications = async () => {
        try {
            const stats = await api.getVirtualHostStats(vhost);
            // For now, we'll just use the connections object keys as app names
            const appNames = Object.keys(stats.connections);
            setApps(appNames.map(name => ({ name, loading: false })));
            setError(null);
        } catch (err) {
            setError('Failed to load applications');
            console.error('Error loading applications:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccordionChange = (app: string) => async (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? app : false);
        
        if (isExpanded) {
            const appIndex = apps.findIndex(a => a.name === app);
            if (appIndex === -1 || apps[appIndex].stats) return;

            setApps(prev => prev.map(a => 
                a.name === app ? { ...a, loading: true } : a
            ));

            try {
                const stats = await api.getApplicationStats(vhost, app);
                setApps(prev => prev.map(a => 
                    a.name === app ? { ...a, stats, loading: false } : a
                ));
            } catch (err) {
                setApps(prev => prev.map(a => 
                    a.name === app ? { ...a, error: 'Failed to load statistics', loading: false } : a
                ));
                console.error(`Error loading stats for ${app}:`, err);
            }
        }
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    return (
        <Box>
            {apps.map(app => (
                <Accordion
                    key={app.name}
                    expanded={expanded === app.name}
                    onChange={handleAccordionChange(app.name)}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            {app.name}
                        </Typography>
                        {app.loading ? (
                            <CircularProgress size={20} />
                        ) : app.stats ? (
                            <Typography sx={{ color: 'text.secondary' }}>
                                Connections: {app.stats.totalConnections} | 
                                Throughput In: {formatBytes(app.stats.lastThroughputIn)}/s | 
                                Out: {formatBytes(app.stats.lastThroughputOut)}/s
                            </Typography>
                        ) : null}
                    </AccordionSummary>
                    <AccordionDetails>
                        {app.error ? (
                            <Alert severity="error">{app.error}</Alert>
                        ) : (
                            <Box>
                                <Tabs value={tabValue} onChange={handleTabChange}>
                                    <Tab label="Statistics" />
                                    <Tab label="Connections" />
                                </Tabs>
                                <TabPanel value={tabValue} index={0}>
                                    {app.stats && (
                                        <Box>
                                            <Typography variant="h6">Throughput</Typography>
                                            <Typography>
                                                Input: {formatBytes(app.stats.lastThroughputIn)}/s
                                            </Typography>
                                            <Typography>
                                                Output: {formatBytes(app.stats.lastThroughputOut)}/s
                                            </Typography>
                                        </Box>
                                    )}
                                </TabPanel>
                                <TabPanel value={tabValue} index={1}>
                                    {app.stats && (
                                        <Box>
                                            <Typography variant="h6">Connection Types</Typography>
                                            {Object.entries(app.stats.connections).map(([type, count]) => (
                                                <Typography key={type}>
                                                    {type}: {count}
                                                </Typography>
                                            ))}
                                        </Box>
                                    )}
                                </TabPanel>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}; 