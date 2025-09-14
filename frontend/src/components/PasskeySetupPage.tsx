import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Container, Paper, CircularProgress, Alert } from '@mui/material';
import { registerPasskey, isSetupRequired } from '../utils/api'; // Use the standard registration function
import KeyIcon from '@mui/icons-material/Key';
import { Button } from '@mui/material';
import { PageHeading } from './GovUkComponents';

const PasskeySetupPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true);
      try {
        const { setupRequired } = await isSetupRequired();
        const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';

        // If setup is done and user is not logged in, they shouldn't be on the setup page.
        if (!setupRequired && !isAuthenticated) {
          navigate('/admin/login');
          return;
        }

        // Check if browser supports passkeys
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
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [navigate]);

  const handleRegisterPasskey = async () => {
    setError(null);
    setRegistering(true);

    try {
      await registerPasskey(); // Call the correct API function
      setSuccess(true);
      // After successful registration, wait a moment and then proceed
      setTimeout(() => {
        // Clear the needsPasskeySetup flag
        localStorage.removeItem('needsPasskeySetup');
        // Redirect to login page or dashboard based on authentication status
        const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        navigate(isAuthenticated ? '/admin/dashboard' : '/admin/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error registering passkey:', error);
      if (error.response?.status === 400 && error.response?.data?.message === 'Passkey already registered' ||
          error.response?.status === 400 && error.response?.data?.message === 'Setup already completed. Use regular registration endpoint.') {
        setSuccess(true); // Already registered is considered success
        setTimeout(() => {
          // Clear the needsPasskeySetup flag
          localStorage.removeItem('needsPasskeySetup');
          // Redirect to login page or dashboard based on authentication status
          const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
          navigate(isAuthenticated ? '/admin/dashboard' : '/admin/login');
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
            Checking passkey compatibility...
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
            onClick={() => navigate('/admin/login')}
          >
            Return to Login
          </Button>
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
              Passkey successfully registered! You will be redirected shortly...
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

export default PasskeySetupPage; 
