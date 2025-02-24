import React, { useState, useEffect } from 'react';
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

const PasskeyRegistration: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    // Check if WebAuthn/passkey is supported
    setPasskeySupported(
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
  }, []);

  const handleRegister = async () => {
    setError('');
    setLoading(true);

    try {
      await registerPasskey();
      setSuccess(true);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message === 'Passkey already registered') {
        setSuccess(true); // Already registered is considered success
      } else {
        setError(error.response?.data?.message || 'Failed to register passkey');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!passkeySupported) {
    return (
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Passkey Authentication
        </Typography>
        <Alert severity="warning">
          Your browser does not support passkeys. Please use a modern browser that supports WebAuthn.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Passkey Authentication
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success ? (
        <Alert severity="success">
          Passkey successfully registered! You can now use it to sign in.
        </Alert>
      ) : (
        <Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Register a passkey to enable secure, passwordless authentication for future logins.
          </Typography>

          <Button
            variant="outlined"
            startIcon={<KeyIcon />}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Register Passkey'}
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default PasskeyRegistration; 