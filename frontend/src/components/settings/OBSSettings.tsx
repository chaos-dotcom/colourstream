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

const defaultSettings: OBSSettingsType = {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
  streamType: 'rtmp',
  useLocalNetwork: false,
  localNetworkMode: 'frontend',
  localNetworkHost: 'localhost',
  localNetworkPort: 4455,
};

export const OBSSettings: React.FC = () => {
  const [settings, setSettings] = useState<OBSSettingsType>(defaultSettings);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitSettings();
  };

  const submitSettings = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const updatedSettings = await updateOBSSettings(settings);
      setSettings(updatedSettings || settings);
      setSuccess('OBS settings updated successfully');
    } catch (error: any) {
      console.error('Failed to update OBS settings:', error);
      setError(error?.response?.data?.message || 'Failed to update OBS settings');
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

          <FormControlLabel
            control={
              <Switch
                checked={settings.useLocalNetwork}
                disabled={loading || !settings.enabled}
                onChange={(e) => {
                  setSettings(prev => ({
                    ...prev,
                    useLocalNetwork: e.target.checked
                  }));
                }}
              />
            }
            label="Use Local Network"
            sx={{ mb: 2 }}
          />

          {settings.useLocalNetwork && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Local Network Mode</InputLabel>
                <Select
                  value={settings.localNetworkMode}
                  label="Local Network Mode"
                  onChange={(e) => {
                    setSettings(prev => ({
                      ...prev,
                      localNetworkMode: e.target.value as 'frontend' | 'backend' | 'custom'
                    }));
                  }}
                  disabled={loading || !settings.enabled}
                >
                  <MenuItem value="frontend">Frontend (Browser to OBS)</MenuItem>
                  <MenuItem value="backend">Backend (Server to OBS)</MenuItem>
                  <MenuItem value="custom">Custom Configuration</MenuItem>
                </Select>
                <FormHelperText>
                  {settings.localNetworkMode === 'frontend' && "Connect directly from browser to OBS"}
                  {settings.localNetworkMode === 'backend' && "Connect from backend server to OBS"}
                  {settings.localNetworkMode === 'custom' && "Use custom host and port configuration"}
                </FormHelperText>
              </FormControl>

              {(settings.localNetworkMode === 'frontend' || settings.localNetworkMode === 'custom') && (
                <>
                  <TextField
                    margin="normal"
                    fullWidth
                    label="Local Network Host"
                    value={settings.localNetworkHost || 'localhost'}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        localNetworkHost: e.target.value
                      }));
                    }}
                    disabled={loading || !settings.enabled}
                    helperText="The hostname or IP address where OBS is running"
                  />
                  <TextField
                    margin="normal"
                    fullWidth
                    type="number"
                    label="Local Network Port"
                    value={settings.localNetworkPort || 4455}
                    onChange={(e) => {
                      setSettings(prev => ({
                        ...prev,
                        localNetworkPort: parseInt(e.target.value) || 4455
                      }));
                    }}
                    disabled={loading || !settings.enabled}
                    helperText="The WebSocket port configured in OBS (default: 4455)"
                  />
                </>
              )}
            </>
          )}

          <TextField
            margin="normal"
            required
            fullWidth
            label="Host"
            value={settings.host}
            onChange={(e) => {
              setSettings(prev => ({
                ...prev,
                host: e.target.value
              }));
            }}
            disabled={loading || !settings.enabled || settings.useLocalNetwork}
            helperText={settings.useLocalNetwork ? "Host settings managed by local network configuration" : undefined}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            type="number"
            label="Port"
            value={settings.port}
            onChange={(e) => {
              setSettings(prev => ({
                ...prev,
                port: parseInt(e.target.value) || 4455
              }));
            }}
            disabled={loading || !settings.enabled || settings.useLocalNetwork}
            helperText={settings.useLocalNetwork ? "Port settings managed by local network configuration" : undefined}
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