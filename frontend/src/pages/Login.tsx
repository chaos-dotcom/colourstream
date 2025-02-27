import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Paper, CircularProgress, Divider } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import PasskeyLogin from '../components/PasskeyLogin';
import FirstTimeSetup from '../components/FirstTimeSetup';
import { checkSetupRequired, getOIDCConfig, loginWithOIDC, handleOIDCCallback } from '../utils/api';
import { Button, WarningText, InsetText, PageHeading } from '../components/GovUkComponents';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcProviderName, setOidcProviderName] = useState('Identity Provider');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is already authenticated
        const isAuthenticated = localStorage.getItem('isAdminAuthenticated') === 'true';
        if (isAuthenticated) {
          navigate('/admin/dashboard');
          return;
        }

        // Check if first-time setup is needed
        const response = await checkSetupRequired();
        setSetupRequired(response.data.setupRequired);

        // Check OIDC configuration
        try {
          const oidcResponse = await getOIDCConfig();
          console.log('OIDC config response:', oidcResponse);
          setOidcEnabled(oidcResponse.config?.enabled || false);
          if (oidcResponse.config?.providerName) {
            setOidcProviderName(oidcResponse.config.providerName);
          }
        } catch (oidcError) {
          console.error('Error fetching OIDC config:', oidcError);
        }

        // Check for stored error message
        const authError = localStorage.getItem('authError');
        if (authError) {
          setError(authError);
          localStorage.removeItem('authError');
        }

        // Check for token in URL (from OIDC callback)
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        if (token) {
          handleOIDCCallback(token);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location]);

  const handleOIDCLogin = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('Initiating OIDC login...');
      try {
        await loginWithOIDC(window.location.origin + '/admin/login');
      } catch (error: any) {
        console.error('OIDC login error:', error);
        if (error.response?.status === 500 && error.response?.data?.message === 'OIDC is not configured or initialized') {
          setError('OIDC SSO is not properly configured. Please contact your administrator.');
        } else {
          setError(error.response?.data?.message || 'OIDC login failed');
        }
        setLoading(false);
      }
    } catch (error: any) {
      console.error('OIDC login error:', error);
      setError(error.response?.data?.message || 'OIDC login failed');
      setLoading(false);
    }
  };

  const handlePasskeyError = (error: any) => {
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
  };

  if (isLoading) {
    return null; // Or show a loading spinner
  }

  if (setupRequired) {
    return (
      <Container>
        <FirstTimeSetup />
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

        <Paper sx={{ p: 4, backgroundColor: '#ffffff', borderRadius: 0, mb: 4 }}>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Sign in to the admin dashboard using one of the available authentication methods.
          </Typography>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Passkey Authentication
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box onClick={() => setError('')}>
                <PasskeyLogin onError={handlePasskeyError} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Use your registered passkey to sign in. This may use your device's biometric sensors or PIN.
              </Typography>
            </Box>
          </Box>
          
          {oidcEnabled && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">OR</Typography>
              </Divider>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Single Sign-On
                </Typography>
                <Button
                  onClick={handleOIDCLogin}
                  disabled={loading}
                  fullWidth={false}
                  type="button"
                  variant="secondary"
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : `Sign in with ${oidcProviderName}`}
                </Button>
                
                <InsetText>
                  This will redirect you to your organization's identity provider for authentication.
                </InsetText>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 