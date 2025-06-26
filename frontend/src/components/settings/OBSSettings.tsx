import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Snackbar,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { getOBSSettings, updateOBSSettings, getOBSConnectionStatus } from '../../utils/api';
import { SectionHeading, InsetText, Button } from '../GovUkComponents';

// Updated OBS Settings interface to match backend
interface OBSSettingsType {
  host: string;
  port: number;
  password?: string;
  enabled: boolean;
  streamType: 'rtmp_custom';
  protocol?: 'rtmp' | 'srt';
  srtUrl?: string;
}

const defaultSettings: OBSSettingsType = {
  host: '192.168.69.186',
  port: 4455,
  password: '123456',
  enabled: false,
  streamType: 'rtmp_custom',
  protocol: 'rtmp'
};

export const OBSSettings: React.FC = () => {
  const [settings, setSettings] = useState<OBSSettingsType>(defaultSettings);
  const [_error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'connecting' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [backendWebSocket, setBackendWebSocket] = useState<WebSocket | null>(null);
  const wsReconnectTimeout = useRef<number | null>(null);
  const wsConnectionAttempts = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const fetchedSettings = await getOBSSettings();
        if (fetchedSettings) {
          // Map the fetched settings to our structure, ensuring all required fields are present
          setSettings({
            host: fetchedSettings.host || '192.168.69.186',
            port: fetchedSettings.port || 4455,
            password: fetchedSettings.password || '',
            enabled: fetchedSettings.enabled || false,
            streamType: 'rtmp_custom',
            protocol: fetchedSettings.protocol || 'rtmp',
            srtUrl: fetchedSettings.srtUrl
          });
        }
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to fetch OBS settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
    
    // Cleanup function to clear any timeouts
    return () => {
      if (wsReconnectTimeout.current) {
        window.clearTimeout(wsReconnectTimeout.current);
      }
    };
  }, []);

  // Add effect to handle backend WebSocket connection
  useEffect(() => {
    const setupBackendWebSocket = () => {
      // Reset connection attempts when settings change
      wsConnectionAttempts.current = 0;
      
      // Clear any existing reconnect timeout
      if (wsReconnectTimeout.current) {
        window.clearTimeout(wsReconnectTimeout.current);
        wsReconnectTimeout.current = null;
      }
      
      // Close any existing connection
      if (backendWebSocket && backendWebSocket.readyState === WebSocket.OPEN) {
        console.log('Closing existing WebSocket connection');
        backendWebSocket.close();
        setBackendWebSocket(null);
      }
      
      if (!settings.enabled) {
        console.log('OBS integration is disabled, not connecting WebSocket');
        return;
      }
      
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        setError('Authentication error: No admin token found');
        return;
      }

      // Don't attempt to reconnect if we've exceeded the maximum attempts
      if (wsConnectionAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
        console.warn(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached, stopping reconnection`);
        setError(`Failed to establish a stable WebSocket connection after ${MAX_RECONNECT_ATTEMPTS} attempts. Please check your network and try again.`);
        return;
      }
      
      wsConnectionAttempts.current++;
      console.log(`WebSocket connection attempt ${wsConnectionAttempts.current} of ${MAX_RECONNECT_ATTEMPTS}`);

      try {
        // Simplify the WebSocket URL construction
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${wsProtocol}//${host}/api/ws/obs-status?token=${token}`;
        console.log('Connecting to WebSocket URL:', wsUrl);

        setConnectionStatus('connecting');
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('Backend WebSocket connected successfully');
          setBackendWebSocket(ws);
          setError(null); // Clear any previous errors
        };

        ws.onmessage = (event) => {
          try {
            console.log('Received WebSocket message:', event.data);
            const data = JSON.parse(event.data);
            if (data.type === 'obs_status') {
              console.log('Updating connection status to:', data.status);
              setConnectionStatus(data.status);
              if (data.error) {
                setLastError(data.error);
                setError(`OBS Connection Error: ${data.error}`);
              } else {
                setLastError(null);
                setError(null);
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('Backend WebSocket error:', error);
          setConnectionStatus('error');
          setError('Failed to connect to backend WebSocket');
        };

        ws.onclose = (event) => {
          console.log('Backend WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          
          setBackendWebSocket(null);
          
          // Only attempt to reconnect if the connection was not closed intentionally
          // and we haven't exceeded the maximum attempts
          if (settings.enabled && wsConnectionAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, wsConnectionAttempts.current), 10000);
            console.log(`Scheduling WebSocket reconnection in ${delay}ms`);
            
            wsReconnectTimeout.current = window.setTimeout(() => {
              setupBackendWebSocket();
            }, delay);
          }
        };
      } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
        setError(`WebSocket connection error: ${error instanceof Error ? error.message : String(error)}`);
        setConnectionStatus('error');
      }
    };

    setupBackendWebSocket();

    // Cleanup function
    return () => {
      if (backendWebSocket) {
        console.log('Cleaning up WebSocket connection on component unmount');
        backendWebSocket.close();
        setBackendWebSocket(null);
      }
      
      if (wsReconnectTimeout.current) {
        window.clearTimeout(wsReconnectTimeout.current);
      }
    };
  }, [settings.enabled]); // Only re-run when enabled state changes

  // Add effect to fetch initial connection status
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (settings.enabled) {
        try {
          const status = await getOBSConnectionStatus();
          setConnectionStatus(status.status);
          if (status.error) {
            setLastError(status.error);
            setError(`OBS Connection Error: ${status.error}`);
          }
        } catch (error: any) {
          console.error('Failed to fetch OBS connection status:', error);
          setConnectionStatus('error');
          setError(error?.response?.data?.message || 'Failed to fetch OBS connection status');
        }
      }
    };

    fetchConnectionStatus();
  }, [settings.enabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitSettings();
  };

  const submitSettings = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Create a clean settings object with all required properties
      const settingsToSubmit: OBSSettingsType = {
        host: settings.host || '192.168.69.186',
        port: settings.port || 4455,
        enabled: settings.enabled,
        streamType: 'rtmp_custom',
        protocol: settings.protocol || 'rtmp',
        ...(settings.password ? { password: settings.password } : {}),
        ...(settings.srtUrl ? { srtUrl: settings.srtUrl } : {})
      };

      // Send settings to server
      console.log('Submitting OBS settings to backend:', settingsToSubmit);
      try {
        const updatedSettings = await updateOBSSettings(settingsToSubmit);
        setSettings(prevSettings => ({...prevSettings, ...updatedSettings || settingsToSubmit}));
        setSuccess('Successfully updated OBS settings');
        
        // Reset connection attempts to trigger a fresh connection
        wsConnectionAttempts.current = 0;
      } catch (error: any) {
        console.error('Failed to update OBS settings:', error);
        console.error('Error response:', error.response?.data);
        
        // Extract the actual error message from the response
        const errorMessage = error.response?.data?.message || 
          'Failed to update OBS settings. Please check all required fields are filled correctly.';
        
        setError(`Connection test failed: ${errorMessage}`);
        return;
      }
    } catch (error: any) {
      console.error('Failed to update OBS settings:', error);
      console.error('Error response:', error.response?.data);
      setError(error?.response?.data?.message || 'Failed to update OBS settings. Please check all required fields are filled correctly.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof OBSSettingsType, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      <SectionHeading>OBS Studio Integration</SectionHeading>
      
      <InsetText>
        Connect to OBS Studio to control streaming directly from the admin dashboard.
        This allows you to start and stop streams for rooms without having to manually configure OBS.
      </InsetText>
      
      {connectionStatus === 'connected' && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Connected to OBS Studio
        </Alert>
      )}
      
      {connectionStatus === 'connecting' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Connecting to OBS Studio...
        </Alert>
      )}
      
      {connectionStatus === 'disconnected' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Not connected to OBS Studio. Please check your settings and ensure OBS is running with the WebSocket server enabled.
        </Alert>
      )}
      
      {connectionStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error connecting to OBS Studio: {lastError}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
            }
            label="Enable OBS Integration"
          />
        </Box>
        
        {settings && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="OBS Host"
                fullWidth
                value={settings.host || '192.168.69.186'}
                onChange={(e) => handleChange('host', e.target.value)}
                helperText="OBS WebSocket server host (IP address or hostname)"
                disabled={loading || !settings.enabled}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="OBS Port"
                fullWidth
                type="number"
                value={settings.port || 4455}
                onChange={(e) => handleChange('port', parseInt(e.target.value))}
                helperText="OBS WebSocket server port (default: 4455)"
                disabled={loading || !settings.enabled}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="OBS Password"
                fullWidth
                type="password"
                value={settings.password || ''}
                onChange={(e) => handleChange('password', e.target.value)}
                helperText="OBS WebSocket server password (if required)"
                disabled={loading || !settings.enabled}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={loading || !settings.enabled}>
                <InputLabel>Stream Type</InputLabel>
                <Select
                  value={settings.streamType || 'rtmp_custom'}
                  onChange={(e) => handleChange('streamType', e.target.value)}
                  label="Stream Type"
                >
                  <MenuItem value="rtmp_custom">RTMP Custom</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth disabled={loading || !settings.enabled}>
                <InputLabel>Protocol</InputLabel>
                <Select
                  value={settings.protocol || 'rtmp'}
                  onChange={(e) => handleChange('protocol', e.target.value)}
                  label="Protocol"
                >
                  <MenuItem value="rtmp">RTMP</MenuItem>
                  <MenuItem value="srt">SRT</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {settings.protocol === 'srt' && (
              <Grid item xs={12}>
                <TextField
                  label="SRT URL"
                  fullWidth
                  value={settings.srtUrl || ''}
                  onChange={(e) => handleChange('srtUrl', e.target.value)}
                  helperText="SRT URL for streaming (e.g., srt://hostname:port)"
                  disabled={loading || !settings.enabled}
                />
              </Grid>
            )}
          </Grid>
        )}
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            onClick={() => handleSubmit(new Event('click') as unknown as React.FormEvent)}
            disabled={loading || !settings.enabled}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Save Settings'}
          </Button>
        </Box>
      </Paper>
      
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
    </Box>
  );
}; 
