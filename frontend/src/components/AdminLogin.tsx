import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { adminLogin, authenticateWithPasskey } from '../utils/api';
import KeyIcon from '@mui/icons-material/Key';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if WebAuthn/passkey is supported
    setPasskeySupported(
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );

    // Check for stored error message
    const authError = localStorage.getItem('authError');
    if (authError) {
      setError(authError);
      localStorage.removeItem('authError');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminLogin(password);
      navigate('/admin/dashboard');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await authenticateWithPasskey();
      navigate('/admin/dashboard');
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message === 'No passkey registered') {
        setError('No passkey registered. Please log in with password first to register a passkey.');
      } else {
        setError(error.response?.data?.message || 'Passkey authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

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

          {passkeySupported && (
            <>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<KeyIcon />}
                onClick={handlePasskeyLogin}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign in with Passkey'}
              </Button>

              <Divider sx={{ mb: 2 }}>
                <Typography color="textSecondary" variant="body2">
                  or
                </Typography>
              </Divider>
            </>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Admin Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ mt: 3, mb: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign in with Password'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLogin; 