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
    type: string;
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
            const applications = await api.getApplications(vhost);
            console.log('Received applications:', applications); // Debug log
            
            // Ensure each application has the correct structure
            const formattedApps = applications.map(app => ({
                name: typeof app === 'string' ? app : app.name,
                type: typeof app === 'string' ? 'default' : (app.type || 'default'),
                loading: false
            }));
            
            console.log('Formatted applications:', formattedApps); // Debug log
            setApps(formattedApps);
            setError(null);
        } catch (err) {
            setError('Failed to load applications');
            console.error('Error loading applications:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAccordionChange = (app: AppData) => async (_event: React.SyntheticEvent, isExpanded: boolean) => {
        console.log('handleAccordionChange called with:', { app, vhost, isExpanded }); // Debug log

        // Ensure app is an object with a name property
        const appName = typeof app === 'string' ? app : app.name;
        
        if (!appName) {
            console.error('App name is missing:', app);
            return;
        }
        if (!vhost) {
            console.error('Vhost is missing:', vhost);
            return;
        }

        setExpanded(isExpanded ? appName : false);
        
        if (isExpanded) {
            const appIndex = apps.findIndex(a => a.name === appName);
            if (appIndex === -1) {
                console.error('App not found in apps array:', app);
                return;
            }

            // Skip if stats already loaded
            if (apps[appIndex].stats) {
                console.log('Stats already loaded for:', appName);
                return;
            }

            // Set loading state
            setApps(prev => prev.map(a => 
                a.name === appName ? { ...a, loading: true, error: undefined } : a
            ));

            try {
                console.log('Fetching stats for:', { vhost, appName });
                const stats = await api.getApplicationStats(vhost, appName);
                console.log('Received stats:', stats); // Debug log
                
                setApps(prev => prev.map(a => 
                    a.name === appName ? { ...a, stats, loading: false } : a
                ));
            } catch (err: any) {
                console.error('Error fetching stats:', { 
                    error: err, 
                    response: err.response,
                    app: appName, 
                    vhost 
                });
                
                const errorMessage = err.response?.data?.message || err.message || 'Failed to load statistics';
                setApps(prev => prev.map(a => 
                    a.name === appName ? { ...a, error: errorMessage, loading: false } : a
                ));
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
                    onChange={handleAccordionChange(app)}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            {app.name} ({app.type})
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