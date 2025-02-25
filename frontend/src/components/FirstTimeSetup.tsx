import React, { useState } from 'react';
import {
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import { registerPasskey } from '../utils/api';
import { useNavigate } from 'react-router-dom';

const FirstTimeSetup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSetup = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await registerPasskey();
      if (result.verified) {
        localStorage.setItem('isAdminAuthenticated', 'true');
        navigate('/admin');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to set up passkey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom align="center">
        Welcome to ColourStream
      </Typography>

      <Typography variant="body1" sx={{ mb: 3 }} align="center">
        This appears to be your first time setting up the system. Please register a passkey to secure your admin account.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="center">
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <KeyIcon />}
          onClick={handleSetup}
          disabled={loading}
          size="large"
        >
          Register Admin Passkey
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }} align="center">
        A passkey is a secure, passwordless way to authenticate. It uses your device's biometric sensors or PIN.
      </Typography>
    </Paper>
  );
};

export default FirstTimeSetup; 