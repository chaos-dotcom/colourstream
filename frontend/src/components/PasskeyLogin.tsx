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
import { authenticateWithPasskey } from '../utils/api';
import { useNavigate } from 'react-router-dom';

const PasskeyLogin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await authenticateWithPasskey();
      navigate('/admin');
    } catch (error: any) {
      setError(error.message || 'Failed to authenticate with passkey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 400, mx: 'auto', mt: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom align="center">
        Admin Login
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
          onClick={handleLogin}
          disabled={loading}
          size="large"
        >
          Sign in with Passkey
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }} align="center">
        Use your registered passkey to sign in. This may use your device's biometric sensors or PIN.
      </Typography>
    </Paper>
  );
};

export default PasskeyLogin; 