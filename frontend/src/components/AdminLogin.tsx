import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
} from '@mui/material';
import { authenticateWithPasskey } from '../utils/api';
import { PageHeading, Button, WarningText, InsetText } from './GovUkComponents';

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
      <Container component="main" maxWidth="md">
        <Box sx={{ mt: 6 }}>
          <PageHeading>Admin Login</PageHeading>
          <Paper sx={{ p: 4, backgroundColor: '#f3f2f1', borderRadius: 0 }}>
            <WarningText>
              Your device or browser does not support passkey authentication.
            </WarningText>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Please use a supported browser (like Chrome, Safari, or Edge) on a compatible device.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="md">
      <Box sx={{ mt: 6 }}>
        <PageHeading>Admin Login</PageHeading>
        
        {error && (
          <Box className="govuk-error-summary" role="alert" tabIndex={-1} aria-labelledby="error-summary-title">
            <Typography variant="h3" component="h2" className="govuk-error-summary__title" id="error-summary-title">
              There is a problem
            </Typography>
            <div className="govuk-error-summary__body">
              <Typography variant="body1">{error}</Typography>
            </div>
          </Box>
        )}

        <Paper sx={{ p: 4, backgroundColor: '#f3f2f1', borderRadius: 0, mb: 4 }}>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Sign in to the admin dashboard using your registered passkey.
          </Typography>
          
          <Button
            onClick={handlePasskeyLogin}
            disabled={loading}
            fullWidth={false}
            type="button"
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in with Passkey'}
          </Button>
          
          <InsetText>
            This will use your device's biometric sensors (fingerprint, face recognition) or PIN for authentication.
          </InsetText>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLogin; 