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
import { getOBSSettings, updateOBSSettings, OBSSettings as OBSSettingsType } from '../../utils/api';
import OBSWebSocket from 'obs-websocket-js';

const defaultSettings: OBSSettingsType = {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
  streamType: 'rtmp',
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

  useEffect(() => {
    fetchSettings();
    return () => {
      // Cleanup OBS connection on unmount
      if (obsInstance) {
        obsInstance.disconnect();
      }
    };
  }, []);

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
      const obs = new OBSWebSocket();
      
      // Try to connect
      await obs.connect(`ws://${settingsToTest.localNetworkHost}:${settingsToTest.localNetworkPort}`, 
        settingsToTest.password);
      
      // If we get here, connection was successful
      setObsInstance(obs);
      return true;
    } catch (error: any) {
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
        streamType: settings.streamType || 'rtmp',
        useLocalNetwork: true,
        localNetworkMode: settings.localNetworkMode || 'frontend',
        ...(settings.password ? { password: settings.password } : {}),
        ...(settings.localNetworkHost ? { localNetworkHost: settings.localNetworkHost } : {}),
        ...(settings.localNetworkPort ? { localNetworkPort: settings.localNetworkPort } : {}),
        ...(settings.srtUrl ? { srtUrl: settings.srtUrl } : {})
      };

      if (settings.localNetworkMode === 'frontend') {
        // For frontend mode, test the connection locally first
        try {
          await testFrontendConnection(settingsToSubmit);
          setSuccess('Successfully connected to OBS');
          // Store settings locally
          localStorage.setItem('obsSettings', JSON.stringify(settingsToSubmit));
        } catch (error: any) {
          setError(error.message);
        }
      } else {
        // For backend/custom modes, send to server
        console.log('Submitting OBS settings to backend:', settingsToSubmit);
        const updatedSettings = await updateOBSSettings(settingsToSubmit);
        setSettings(updatedSettings || settingsToSubmit);
        setSuccess('OBS settings updated successfully');
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
        <Box component="form" onSubmit={handleSubmit}>
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
              setSettings(prev => ({
                ...prev,
                password: e.target.value
              }));
            }}
            disabled={loading || !settings.enabled}
            helperText="The password configured in OBS WebSocket settings (leave blank if no password is set)"
          />
          
          <FormControl component="fieldset" sx={{ mb: 2, mt: 2, width: '100%' }}>
            <FormLabel component="legend">Stream Protocol</FormLabel>
            <RadioGroup
              row
              value={settings.streamType}
              onChange={(e) => {
                setSettings(prev => ({
                  ...prev,
                  streamType: e.target.value as 'rtmp' | 'srt'
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

          {settings.streamType === 'srt' && (
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