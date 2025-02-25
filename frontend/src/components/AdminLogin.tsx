import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { authenticateWithPasskey } from '../utils/api';
import KeyIcon from '@mui/icons-material/Key';

const AdminLogin: React.FC = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if WebAuthn/passkey is supported
    const checkPasskeySupport = async () => {
      try {
        const supported = window.PublicKeyCredential !== undefined &&
          typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
        
        if (supported) {
          const result = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setPasskeySupported(result);
        } else {
          setPasskeySupported(false);
        }
      } catch (error) {
        console.error('Error checking passkey support:', error);
        setPasskeySupported(false);
      }
    };

    checkPasskeySupport();

    // Check for stored error message
    const authError = localStorage.getItem('authError');
    if (authError) {
      setError(authError);
      localStorage.removeItem('authError');
    }
  }, []);

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await authenticateWithPasskey();
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error('Passkey authentication error:', error);
      
      if (error.message === 'User declined to authenticate with passkey') {
        setError('Authentication cancelled by user');
      } else if (error.response?.status === 400 && error.response?.data?.message === 'No passkey registered') {
        setError('No passkey registered. Please complete the first-time setup.');
      } else if (error.name === 'NotAllowedError') {
        setError('Authentication cancelled by user');
      } else if (error.name === 'SecurityError') {
        setError('Security error: The origin is not secure or does not match the registered origin');
      } else {
        setError(error.response?.data?.message || 'Passkey authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!passkeySupported) {
    return (
      <Container component="main" maxWidth="xs">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Typography variant="h5" component="h1" align="center" gutterBottom>
              Device Not Supported
            </Typography>
            <Typography align="center" color="error">
              Your device or browser does not support passkey authentication.
              Please use a supported browser (like Chrome, Safari, or Edge) on a compatible device.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Admin Login
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            startIcon={<KeyIcon />}
            onClick={handlePasskeyLogin}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Sign in with Passkey'}
          </Button>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }} align="center">
            Use your registered passkey to sign in. This may use your device's biometric sensors or PIN.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLogin; 