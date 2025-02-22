import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { getOBSSettings, updateOBSSettings, OBSSettings as OBSSettingsType } from '../utils/api';

const defaultSettings: OBSSettingsType = {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
};

const OBSSettings = () => {
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
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        OBS WebSocket Settings
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
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
    </Paper>
  );
};

export default OBSSettings; 