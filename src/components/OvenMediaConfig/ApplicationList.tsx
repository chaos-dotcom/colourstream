import React, { useEffect, useState } from 'react';
import { OvenMediaEngineApi, OutputProfile, PushTarget, RecordingConfig } from '../../lib/oven-api';
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Box,
    Grid,
    Paper,
    CircularProgress,
    Alert,
    Tabs,
    Tab,
    Card,
    CardContent,
    List,
    ListItem,
    ListItemText,
    Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface ApplicationListProps {
    api: OvenMediaEngineApi;
    vhost: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <Box role="tabpanel" hidden={value !== index} p={2}>
        {value === index && children}
    </Box>
);

interface AppData {
    stats: {
        totalConnections: number;
        lastThroughputIn: number;
        lastThroughputOut: number;
    };
    outputProfiles: OutputProfile[];
    pushTargets: PushTarget[];
    recordingConfigs: RecordingConfig[];
}

export const ApplicationList: React.FC<ApplicationListProps> = ({ api, vhost }) => {
    const [appData, setAppData] = useState<Record<string, AppData>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [tabValue, setTabValue] = useState(0);

    const loadAppData = async (app: string) => {
        if (appData[app]) return;

        setLoading(prev => ({ ...prev, [app]: true }));
        try {
            const [
                statsResponse,
                outputProfilesResponse,
                pushTargetsResponse,
                recordingConfigsResponse
            ] = await Promise.all([
                api.getApplicationStats(vhost, app),
                api.getOutputProfiles(vhost, app),
                api.getPushTargets(vhost, app),
                api.getRecordingConfigs(vhost, app)
            ]);

            setAppData(prev => ({
                ...prev,
                [app]: {
                    stats: {
                        totalConnections: statsResponse.response.totalConnections,
                        lastThroughputIn: statsResponse.response.lastThroughputIn,
                        lastThroughputOut: statsResponse.response.lastThroughputOut
                    },
                    outputProfiles: outputProfilesResponse.response,
                    pushTargets: pushTargetsResponse.response,
                    recordingConfigs: recordingConfigsResponse.response
                }
            }));
            setErrors(prev => ({ ...prev, [app]: '' }));
        } catch (err) {
            setErrors(prev => ({
                ...prev,
                [app]: err instanceof Error ? err.message : 'Failed to load application data'
            }));
        } finally {
            setLoading(prev => ({ ...prev, [app]: false }));
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}/s`;
    };

    const renderOutputProfiles = (profiles: OutputProfile[]) => (
        <List>
            {profiles.map(profile => (
                <Card key={profile.name} sx={{ mb: 2 }}>
                    <CardContent>
                        <Typography variant="h6">{profile.name}</Typography>
                        {profile.encodes.videos && (
                            <Box mt={2}>
                                <Typography variant="subtitle1">Video Encodings</Typography>
                                <Grid container spacing={2}>
                                    {profile.encodes.videos.map((video, idx) => (
                                        <Grid item xs={12} sm={6} key={idx}>
                                            <Paper variant="outlined" sx={{ p: 1 }}>
                                                <Typography variant="subtitle2">
                                                    {video.codec} - {video.width}x{video.height}
                                                </Typography>
                                                <Typography>
                                                    {video.bitrate}kbps @ {video.framerate}fps
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        )}
                        {profile.encodes.audios && (
                            <Box mt={2}>
                                <Typography variant="subtitle1">Audio Encodings</Typography>
                                <Grid container spacing={2}>
                                    {profile.encodes.audios.map((audio, idx) => (
                                        <Grid item xs={12} sm={6} key={idx}>
                                            <Paper variant="outlined" sx={{ p: 1 }}>
                                                <Typography variant="subtitle2">{audio.codec}</Typography>
                                                <Typography>
                                                    {audio.bitrate}kbps, {audio.samplerate}Hz, {audio.channel}ch
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ))}
        </List>
    );

    const renderPushTargets = (targets: PushTarget[]) => (
        <List>
            {targets.map(target => (
                <ListItem key={target.id || target.url}>
                    <ListItemText
                        primary={target.url}
                        secondary={
                            <Box>
                                <Chip 
                                    label={target.protocol.toUpperCase()} 
                                    size="small" 
                                    sx={{ mr: 1 }} 
                                />
                                {target.streamName && (
                                    <Typography component="span">
                                        Stream: {target.streamName}
                                    </Typography>
                                )}
                            </Box>
                        }
                    />
                </ListItem>
            ))}
        </List>
    );

    const renderRecordingConfigs = (configs: RecordingConfig[]) => (
        <List>
            {configs.map(config => (
                <ListItem key={config.id || config.filePath}>
                    <ListItemText
                        primary={config.filePath}
                        secondary={
                            <Box>
                                <Chip 
                                    label={config.enabled ? 'Enabled' : 'Disabled'} 
                                    color={config.enabled ? 'success' : 'default'}
                                    size="small" 
                                    sx={{ mr: 1 }} 
                                />
                                <Chip 
                                    label={config.fileFormat.toUpperCase()} 
                                    size="small" 
                                    sx={{ mr: 1 }} 
                                />
                                {config.segmentationRule.intervalInSeconds && (
                                    <Typography component="span">
                                        Interval: {config.segmentationRule.intervalInSeconds}s
                                    </Typography>
                                )}
                                {config.segmentationRule.sizeInMb && (
                                    <Typography component="span">
                                        Size: {config.segmentationRule.sizeInMb}MB
                                    </Typography>
                                )}
                            </Box>
                        }
                    />
                </ListItem>
            ))}
        </List>
    );

    return (
        <Box mt={2}>
            <Typography variant="h6" gutterBottom>Applications</Typography>
            {Object.entries(appData).map(([app, data]) => (
                <Accordion 
                    key={app}
                    onChange={(_, expanded) => expanded && loadAppData(app)}
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>{app}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {loading[app] ? (
                            <Box display="flex" justifyContent="center" p={2}>
                                <CircularProgress />
                            </Box>
                        ) : errors[app] ? (
                            <Alert severity="error">{errors[app]}</Alert>
                        ) : (
                            <Box>
                                <Paper elevation={0} sx={{ p: 2, mb: 2 }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Total Connections</Typography>
                                            <Typography>{data.stats.totalConnections}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Throughput In</Typography>
                                            <Typography>{formatBytes(data.stats.lastThroughputIn)}</Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <Typography variant="subtitle2">Throughput Out</Typography>
                                            <Typography>{formatBytes(data.stats.lastThroughputOut)}</Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                                        <Tab label="Output Profiles" />
                                        <Tab label="Push Targets" />
                                        <Tab label="Recording" />
                                    </Tabs>
                                </Box>

                                <TabPanel value={tabValue} index={0}>
                                    {renderOutputProfiles(data.outputProfiles)}
                                </TabPanel>
                                <TabPanel value={tabValue} index={1}>
                                    {renderPushTargets(data.pushTargets)}
                                </TabPanel>
                                <TabPanel value={tabValue} index={2}>
                                    {renderRecordingConfigs(data.recordingConfigs)}
                                </TabPanel>
                            </Box>
                        )}
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}; 