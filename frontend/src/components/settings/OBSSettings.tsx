import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { getOBSSettings, updateOBSSettings, OBSSettings as OBSSettingsType, getOBSConnectionStatus } from '../../utils/api';
import OBSWebSocket from 'obs-websocket-js';

const defaultSettings: OBSSettingsType = {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
  streamType: 'rtmp_custom',
  protocol: 'rtmp',
  useLocalNetwork: true,
  localNetworkMode: 'frontend',
  localNetworkHost: 'localhost',
  localNetworkPort: 4455,
  srtUrl: undefined
};

export const OBSSettings: React.FC = () => {
  const [settings, setSettings] = useState<OBSSettingsType>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [obsInstance, setObsInstance] = useState<OBSWebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'connecting' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [backendWebSocket, setBackendWebSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    fetchSettings();
    return () => {
      cleanupConnections();
    };
  }, []);

  // Add effect to fetch initial connection status for backend mode
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (settings.localNetworkMode === 'backend' && settings.enabled) {
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
  }, [settings.localNetworkMode, settings.enabled]);

  const cleanupConnections = () => {
    cleanupOBSConnection();
    if (backendWebSocket) {
      backendWebSocket.close();
      setBackendWebSocket(null);
    }
  };

  const cleanupOBSConnection = () => {
    if (obsInstance) {
      try {
        obsInstance.disconnect();
        setObsInstance(null);
        setConnectionStatus('disconnected');
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  };

  const setupOBSEventHandlers = (obs: OBSWebSocket) => {
    obs.on('Hello', (data) => {
      console.log('Received Hello from OBS:', data);
    });

    obs.on('Identified', () => {
      if (settings.localNetworkMode === 'frontend') {
        setConnectionStatus('connected');
        setError(null);
        setSuccess('Connected to OBS successfully');
      }
    });

    obs.on('ConnectionOpened', () => {
      console.log('WebSocket connection opened');
    });

    obs.on('ConnectionClosed', () => {
      if (settings.localNetworkMode === 'frontend') {
        setConnectionStatus('disconnected');
        if (lastError) {
          setError(`Connection closed: ${lastError}`);
        }
      }
    });

    obs.on('ConnectionError', (err: Error) => {
      if (settings.localNetworkMode === 'frontend') {
        setConnectionStatus('error');
        setLastError(err.message);
        setError(`Connection error: ${err.message}`);
      }
    });

    // Add periodic connection check only for frontend mode
    const checkInterval = setInterval(async () => {
      if (obs && connectionStatus === 'connected' && settings.localNetworkMode === 'frontend') {
        try {
          const { obsVersion } = await obs.call('GetVersion');
          console.debug('Connection check successful - OBS version:', obsVersion);
        } catch (error) {
          setConnectionStatus('error');
          setError('Lost connection to OBS');
          cleanupOBSConnection();
        }
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const fetchedSettings = await getOBSSettings();
      setSettings(fetchedSettings || defaultSettings);
    } catch (error: any) {
      console.error('Failed to fetch OBS settings:', error);
      setError(error?.response?.data?.message || 'Failed to fetch OBS settings');
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const testFrontendConnection = async (settingsToTest: OBSSettingsType) => {
    try {
      setConnectionStatus('connecting');
      const obs = new OBSWebSocket();
      
      // Setup event handlers before connecting
      setupOBSEventHandlers(obs);
      
      // Try to connect with proper identification
      await obs.connect(
        `ws://${settingsToTest.localNetworkHost}:${settingsToTest.localNetworkPort}`,
        settingsToTest.password,
        {
          eventSubscriptions: 0xFFFFFFFF, // Subscribe to all events
          rpcVersion: 1
        }
      );
      
      setObsInstance(obs);
      return true;
    } catch (error: any) {
      setConnectionStatus('error');
      setLastError(error.message);
      console.error('Failed to connect to OBS:', error);
      throw new Error(`Failed to connect to OBS: ${error.message}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitSettings();
  };

  const submitSettings = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Create a clean settings object
      const settingsToSubmit: OBSSettingsType = {
        host: settings.localNetworkHost || 'localhost',
        port: settings.localNetworkPort || 4455,
        enabled: settings.enabled,
        streamType: 'rtmp_custom',  // Always rtmp_custom for OBS
        protocol: settings.protocol || 'rtmp',  // Track actual protocol separately
        useLocalNetwork: true,
        localNetworkMode: settings.localNetworkMode || 'frontend',
        ...(settings.password ? { password: settings.password } : {}),
        ...(settings.localNetworkHost ? { localNetworkHost: settings.localNetworkHost } : {}),
        ...(settings.localNetworkPort ? { localNetworkPort: settings.localNetworkPort } : {}),
        ...(settings.srtUrl ? { srtUrl: settings.srtUrl } : {})
      };

      if (settings.localNetworkMode === 'frontend') {
        // For frontend mode, just test if we can connect to OBS
        try {
          await testFrontendConnection(settingsToSubmit);
          setSuccess('Successfully connected to OBS. You can now control OBS directly from your browser.');
          
          // We still need to save the stream settings (RTMP/SRT) to the backend
          await updateOBSSettings({
            ...settingsToSubmit,
            // For frontend mode, we don't send connection details to backend
            host: 'localhost',
            port: 4455,
            password: '',
            localNetworkHost: 'localhost',
            localNetworkPort: 4455
          });
        } catch (error: any) {
          setError(`Failed to connect to OBS: ${error.message}`);
        }
      } else {
        // For backend mode, send all settings to server
        console.log('Submitting OBS settings to backend:', settingsToSubmit);
        try {
          const updatedSettings = await updateOBSSettings(settingsToSubmit);
          setSettings(updatedSettings || settingsToSubmit);
          setSuccess('Successfully connected to OBS and updated settings');
        } catch (error: any) {
          console.error('Failed to update OBS settings:', error);
          console.error('Error response:', error.response?.data);
          
          // Extract the actual error message from the response
          const errorMessage = error.response?.data?.message || 
            'Failed to update OBS settings. Please check all required fields are filled correctly.';
          
          setError(`Connection test failed: ${errorMessage}`);
          return;
        }
      }
    } catch (error: any) {
      console.error('Failed to update OBS settings:', error);
      console.error('Error response:', error.response?.data);
      setError(error?.response?.data?.message || 'Failed to update OBS settings. Please check all required fields are filled correctly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          OBS WebSocket Settings
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              Status: 
            </Typography>
            <Box sx={{ 
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: 
                connectionStatus === 'connected' ? '#4caf50' :
                connectionStatus === 'connecting' ? '#ff9800' :
                connectionStatus === 'error' ? '#f44336' :
                '#9e9e9e',
              transition: 'background-color 0.3s ease',
              boxShadow: (theme) => `0 0 8px ${
                connectionStatus === 'connected' ? theme.palette.success.main :
                connectionStatus === 'connecting' ? theme.palette.warning.main :
                connectionStatus === 'error' ? theme.palette.error.main :
                'transparent'
              }`
            }} />
            <Typography variant="body2" sx={{ 
              color: (theme) => 
                connectionStatus === 'connected' ? theme.palette.success.main :
                connectionStatus === 'connecting' ? theme.palette.warning.main :
                connectionStatus === 'error' ? theme.palette.error.main :
                theme.palette.text.secondary,
              fontWeight: 'medium'
            }}>
              {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                disabled={loading}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    enabled: e.target.checked
                  }));
                }}
              />
            }
            label="Enable OBS Integration"
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Connection Mode</InputLabel>
            <Select
              value={settings.localNetworkMode}
              label="Connection Mode"
              onChange={(e) => {
                const mode = e.target.value as 'frontend' | 'backend';
                setSettings(prev => ({
                  ...prev,
                  localNetworkMode: mode,
                  useLocalNetwork: true,
                  // Keep existing values or set defaults
                  localNetworkHost: prev.localNetworkHost || 'localhost',
                  localNetworkPort: prev.localNetworkPort || 4455,
                  // Also update the main host/port to match
                  host: prev.localNetworkHost || 'localhost',
                  port: prev.localNetworkPort || 4455
                }));
              }}
              disabled={loading || !settings.enabled}
            >
              <MenuItem value="frontend">Browser to OBS Connection</MenuItem>
              <MenuItem value="backend">Server to OBS Connection</MenuItem>
            </Select>
            <FormHelperText>
              {settings.localNetworkMode === 'frontend' && "Connect directly from your browser to OBS (OBS must be running on your local machine)"}
              {settings.localNetworkMode === 'backend' && "Connect from the server to OBS (OBS can be running anywhere the server can reach)"}
            </FormHelperText>
          </FormControl>

          <TextField
            margin="normal"
            fullWidth
            required
            label={settings.localNetworkMode === 'frontend' ? "OBS WebSocket Host" : "OBS Host"}
            value={settings.localNetworkHost || 'localhost'}
            onChange={(e) => {
              const newHost = e.target.value;
              setSettings(prev => ({
                ...prev,
                localNetworkHost: newHost,
                host: newHost // Keep both in sync
              }));
            }}
            disabled={loading || !settings.enabled}
            helperText={
              settings.localNetworkMode === 'frontend' 
                ? "The hostname or IP address where OBS is running (usually localhost)"
                : "The hostname or IP address where OBS is running relative to the server"
            }
          />
          <TextField
            margin="normal"
            fullWidth
            required
            type="number"
            label={settings.localNetworkMode === 'frontend' ? "OBS WebSocket Port" : "OBS Port"}
            value={settings.localNetworkPort || 4455}
            onChange={(e) => {
              const newPort = parseInt(e.target.value) || 4455;
              setSettings(prev => ({
                ...prev,
                localNetworkPort: newPort,
                port: newPort // Keep both in sync
              }));
            }}
            disabled={loading || !settings.enabled}
            helperText="The WebSocket port configured in OBS (default: 4455)"
          />

          <TextField
            margin="normal"
            fullWidth
            label="Password"
            type="password"
            value={settings.password || ''}
            onChange={(e) => {
              const newPassword = e.target.value.trim();
              setSettings(prev => ({
                ...prev,
                password: newPassword || undefined // Only set if not empty
              }));
            }}
            disabled={loading || !settings.enabled}
            helperText={
              settings.localNetworkMode === 'frontend' 
                ? "The password configured in OBS WebSocket settings (leave blank if authentication is disabled in OBS)"
                : "The password configured in OBS WebSocket settings for the remote OBS instance"
            }
          />
          
          <FormControl component="fieldset" sx={{ mb: 2, mt: 2, width: '100%' }}>
            <FormLabel component="legend">Stream Protocol</FormLabel>
            <RadioGroup
              row
              value={settings.protocol}
              onChange={(e) => {
                setSettings(prev => ({
                  ...prev,
                  protocol: e.target.value as 'rtmp' | 'srt',
                  streamType: 'rtmp_custom'  // Always rtmp_custom
                }));
              }}
            >
              <FormControlLabel 
                value="rtmp" 
                control={<Radio />} 
                label="RTMP" 
                disabled={loading || !settings.enabled}
              />
              <FormControlLabel 
                value="srt" 
                control={<Radio />} 
                label="SRT" 
                disabled={loading || !settings.enabled}
              />
            </RadioGroup>
          </FormControl>

          {settings.protocol === 'srt' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Using SRT URL format:
              <br />
              <code style={{ wordBreak: 'break-all' }}>
                srt://live.colourstream.johnrogerscolour.co.uk:9999?streamid=[encoded-stream-id]&latency=2000000
              </code>
              <br />
              <small>The stream-id will be automatically URL encoded and include the full path with your stream key. Leave the Stream Key field blank in OBS.</small>
            </Alert>
          )}
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3 }}
            disabled={loading || !settings.enabled}
          >
            {loading ? <CircularProgress size={24} /> : 'Save Settings'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}; 