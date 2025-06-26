import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, Typography, Container, Paper, CircularProgress, Alert } from '@mui/material';
import { getPasskeys } from '../utils/api';
import { Button as GovUkButton } from './GovUkComponents';

interface RequirePasskeyProps {
  children: React.ReactNode;
}

const RequirePasskey: React.FC<RequirePasskeyProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
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
        setPasskeyRegistered(passkeys.length > 0);
      } catch (error) {
        console.error('Error checking passkey registration:', error);
        // If we can't check, we'll assume they have one to avoid blocking access
        setPasskeyRegistered(true);
      } finally {
        setLoading(false);
      }
    };

    checkPasskeySupport();
    checkPasskeyRegistration();
  }, []);

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

  // If passkey is registered, render children
  if (passkeyRegistered) {
    return <>{children}</>;
  }

  // If browser doesn't support passkeys
  if (!passkeySupported) {
    return (
      <Container component="main" maxWidth="md">
        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Typography variant="h5" component="h1" gutterBottom>
            Passkey Not Supported
          </Typography>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Your browser does not support passkeys. Please use a modern browser that supports WebAuthn.
          </Alert>
          <GovUkButton 
            variant="secondary"
            onClick={() => navigate('/admin/dashboard')}
          >
            Continue to Dashboard
          </GovUkButton>
        </Paper>
      </Container>
    );
  }

  // If no passkey is registered, redirect to passkey registration page
  return <Navigate to="/admin/setup-passkey" replace />;
};

export default RequirePasskey; 
