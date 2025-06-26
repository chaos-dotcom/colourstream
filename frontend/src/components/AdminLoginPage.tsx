import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Divider,
} from '@mui/material';
import { authenticateWithPasskey, loginWithOIDC, getOIDCConfig } from '../utils/api';
import { PageHeading, Button, InsetText } from './GovUkComponents';
import axios from 'axios';

const AdminLoginPage: React.FC = () => {
  console.log('AdminLoginPage component rendering');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcProviderName, setOidcProviderName] = useState('Identity Provider');
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log('AdminLoginPage component mounted');
    
    // Check for token in URL query parameters (from OIDC callback)
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const code = params.get('code');
    
    // If we have a token directly in the URL
    if (token) {
      console.log('Found token in URL, setting authentication state');
      // Store auth token
      localStorage.setItem('adminToken', token);
      localStorage.setItem('isAdminAuthenticated', 'true');
      localStorage.setItem('authToken', token);
      localStorage.setItem('authTimestamp', Date.now().toString());
      
      // Apply token to axios default headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Remove token from URL (to avoid exposing it in browser history)
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Navigate to dashboard
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 300);
      
      return;
    }
    
    // If we have a code parameter, this is an OIDC callback
    if (code || location.pathname.includes('/callback')) {
      console.log('Detected OIDC callback with code parameter');
      setLoading(true);
      
      // Handle the OIDC callback
      import('../utils/api').then(({ handleOIDCCallback }) => {
        handleOIDCCallback()
          .then(result => {
            console.log('OIDC callback result:', result);
            if (result.success) {
              console.log('OIDC authentication successful, navigating to dashboard');
              navigate('/admin/dashboard');
            } else {
              console.error('OIDC authentication failed:', result.error);
              setError(result.error || 'Failed to complete authentication');
            }
          })
          .catch(err => {
            console.error('Error handling OIDC callback:', err);
            setError('Failed to complete authentication');
          })
          .finally(() => {
            setLoading(false);
            setInitializing(false);
          });
      });
      
      return;
    }
    
    // Check OIDC config
    console.log('Checking OIDC config...');
    getOIDCConfig()
      .then(response => {
        console.log('OIDC config response:', response);
        setOidcEnabled(response.config?.enabled || false);
        if (response.config?.providerName) {
          setOidcProviderName(response.config.providerName);
        }
        console.log('OIDC enabled:', response.config?.enabled);
        setInitializing(false);
      })
      .catch(err => {
        console.error('Failed to get OIDC config:', err);
        setOidcEnabled(false);
        setInitializing(false);
      });
      
    // Check if this is an OIDC callback
    const isOidcCallback = location.pathname.includes('/auth/oidc/callback');
    console.log('Is OIDC callback:', isOidcCallback);
  }, [navigate, location]);

  const handlePasskeyError = (error: any) => {
    console.error('Passkey authentication error:', error);
    
    if (error.message === 'User declined to authenticate with passkey') {
      setError('Authentication cancelled by user');
    } else if (error.response?.status === 400 && error.response?.data?.message === 'No passkey registered') {
      console.log('No passkey registered, redirecting to passkey registration page');
      // Redirect to passkey registration page
      setTimeout(() => {
        navigate('/admin/setup-passkey');
      }, 300);
    } else if (error.name === 'NotAllowedError') {
      setError('Authentication cancelled by user');
    } else if (error.name === 'SecurityError') {
      setError('Security error: The origin is not secure or does not match the registered origin');
    } else {
      setError(error.response?.data?.message || 'Passkey authentication failed');
    }
  };

  const handlePasskeyLogin = async () => {
    console.log('Passkey login button clicked');
    setError('');
    setLoading(true);

    try {
      console.log('Starting passkey authentication...');
      const result = await authenticateWithPasskey();
      console.log('Passkey authentication result:', result);
      
      if (result.success && result.token) {
        console.log('Passkey authentication successful, setting auth state');
        
        // Ensure authentication state is properly set
        localStorage.setItem('isAdminAuthenticated', 'true');
        localStorage.setItem('adminToken', result.token);
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('authTimestamp', Date.now().toString());
        
        // Apply the token to axios default headers
        axios.defaults.headers.common['Authorization'] = `Bearer ${result.token}`;
        
        console.log('Authentication state set, navigating to dashboard');
        
        // Add a small delay to ensure localStorage is updated before navigation
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 300);
      } else {
        console.error('Passkey authentication failed:', result.error);
        setError(result.error || 'Passkey authentication failed');
      }
    } catch (error: any) {
      console.error('Unexpected error during passkey authentication:', error);
      handlePasskeyError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = async () => {
    console.log('OIDC login button clicked');
    setError('');
    setLoading(true);

    try {
      // Pass the current URL as the return URL
      await loginWithOIDC(window.location.origin + '/admin/dashboard');
    } catch (error: any) {
      console.error('OIDC login error:', error);
      setError(error.message || 'OIDC login failed');
      setLoading(false);
    }
  };

  // Show loading indicator during initialization
  if (initializing) {
    console.log('AdminLoginPage is initializing...');
    return (
      <Container component="main" maxWidth="md">
        <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Initializing authentication options...
          </Typography>
        </Box>
      </Container>
    );
  }

  console.log('AdminLoginPage rendering with state:', { oidcEnabled, error, loading });

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
          
          {/* Always show both authentication options */}
          {/* Show OIDC login first if enabled */}
          {oidcEnabled && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Single Sign-On
              </Typography>
              <Button
                onClick={handleOIDCLogin}
                disabled={loading}
                fullWidth={false}
                type="button"
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : `Sign in with ${oidcProviderName}`}
              </Button>
              
              <InsetText>
                This will redirect you to your organization's identity provider for authentication.
              </InsetText>
            </Box>
          )}
          
          {oidcEnabled && (
            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">OR</Typography>
            </Divider>
          )}
          
          {/* Always show passkey option */}
          <Box sx={{ mt: oidcEnabled ? 2 : 0 }}>
            <Typography variant="h6" gutterBottom>
              Passkey Authentication
            </Typography>
            <Button
              onClick={handlePasskeyLogin}
              disabled={loading}
              fullWidth={false}
              type="button"
              variant={oidcEnabled ? "secondary" : "primary"}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : "Sign in with Passkey"}
            </Button>
            
            <InsetText>
              This will use your device's biometric sensors (fingerprint, face recognition) or PIN for authentication.
            </InsetText>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLoginPage; 
