import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Container, Paper, CircularProgress, Alert } from '@mui/material';
import { getPasskeys, registerPasskey } from '../utils/api';
import KeyIcon from '@mui/icons-material/Key';
import { Button } from '@mui/material';
import { PageHeading } from './GovUkComponents';

const PasskeyRegistrationPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Check if browser supports passkeys
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

    // Check if the user has a passkey registered
    const checkPasskeyRegistration = async () => {
      try {
        const passkeys = await getPasskeys();
        if (passkeys.length > 0) {
          setPasskeyRegistered(true);
          // If passkey is already registered, redirect to dashboard
          setTimeout(() => {
            navigate('/admin/dashboard');
          }, 1000);
        } else {
          setPasskeyRegistered(false);
        }
      } catch (error) {
        console.error('Error checking passkey registration:', error);
        // If we can't check, we'll assume they need to register
        setPasskeyRegistered(false);
      } finally {
        setLoading(false);
      }
    };

    checkPasskeySupport();
    checkPasskeyRegistration();
  }, [navigate]);

  const handleRegisterPasskey = async () => {
    setError(null);
    setRegistering(true);

    try {
      await registerPasskey();
      setSuccess(true);
      // After successful registration, wait a moment and then proceed
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (error: any) {
      console.error('Error registering passkey:', error);
      if (error.response?.status === 400 && error.response?.data?.message === 'Passkey already registered') {
        setSuccess(true); // Already registered is considered success
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 2000);
      } else {
        setError(error.response?.data?.message || 'Failed to register passkey');
      }
    } finally {
      setRegistering(false);
    }
  };

  // If still loading, show loading spinner
  if (loading) {
    return (
      <Container component="main" maxWidth="md">
        <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Checking passkey registration...
          </Typography>
        </Box>
      </Container>
    );
  }

  // If browser doesn't support passkeys
  if (!passkeySupported) {
    return (
      <Container component="main" maxWidth="md">
        <PageHeading>Passkey Not Supported</PageHeading>
        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Your browser does not support passkeys. Please use a modern browser that supports WebAuthn.
          </Alert>
          <Button 
            variant="contained"
            color="primary"
            onClick={() => navigate('/admin/dashboard')}
          >
            Continue to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  // If passkey is already registered
  if (passkeyRegistered) {
    return (
      <Container component="main" maxWidth="md">
        <PageHeading>Passkey Already Registered</PageHeading>
        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            You already have a passkey registered. Redirecting to dashboard...
          </Alert>
          <CircularProgress size={24} sx={{ ml: 2 }} />
        </Paper>
      </Container>
    );
  }

  // If no passkey is registered, show registration screen
  return (
    <Container component="main" maxWidth="md">
      <PageHeading>Passkey Registration Required</PageHeading>
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Secure Your Account
        </Typography>

        <Typography variant="body1" sx={{ mb: 3 }}>
          For security reasons, you need to register a passkey as a backup authentication method. 
          This will allow you to sign in even if the SSO provider is unavailable.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success ? (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              Passkey successfully registered! You will be redirected to the dashboard shortly...
            </Alert>
            <CircularProgress size={24} sx={{ ml: 2 }} />
          </Box>
        ) : (
          <Button
            variant="contained"
            color="primary"
            startIcon={<KeyIcon />}
            onClick={handleRegisterPasskey}
            disabled={registering}
            size="large"
          >
            {registering ? <CircularProgress size={24} color="inherit" /> : 'Register Passkey'}
          </Button>
        )}
      </Paper>
    </Container>
  );
};

export default PasskeyRegistrationPage; 