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
} from '@mui/material';
import { getOBSSettings, updateOBSSettings, OBSSettings as OBSSettingsType } from '../../utils/api';

const defaultSettings: OBSSettingsType = {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
  streamType: 'rtmp',
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
            disabled={loading || !settings.enabled}
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
            disabled={loading || !settings.enabled}
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