import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';

// Define the base URL correctly
const baseURL = process.env.REACT_APP_API_URL || '/api';

const OIDCCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('OIDC Callback component: Processing callback');
        console.log('Raw location:', location);
        console.log('Location search:', location.search);
        
        // Parse the URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        console.log('Parsed params:', { 
          code: code ? `${code.substring(0, 5)}...` : null, 
          state, 
          error, 
          errorDescription 
        });
        
        // Check for errors in the callback
        if (error) {
          const errorMsg = errorDescription || `Authentication error: ${error}`;
          console.error(errorMsg);
          setError(errorMsg);
          localStorage.setItem('authError', errorMsg);
          setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
          return;
        }
        
        // Validate required parameters
        if (!code) {
          const errorMsg = 'No authorization code received from the identity provider';
          console.error(errorMsg);
          setError(errorMsg);
          localStorage.setItem('authError', errorMsg);
          setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
          return;
        }
        
        // Validate state parameter (optional but recommended)
        const storedState = localStorage.getItem('oidcState');
        console.log('State comparison:', { received: state, stored: storedState });

        if (storedState && state !== storedState) {
          const errorMsg = 'Invalid state parameter - possible security risk';
          console.error(errorMsg, { received: state, expected: storedState });
          setError(errorMsg);
          localStorage.setItem('authError', errorMsg);
          setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
          return;
        }
        
        // Clean up state storage
        localStorage.removeItem('oidcState');
        
        // Exchange the code for a token via the backend API
        try {
          console.log('Exchanging code for token with backend');
          
          // Make a direct request to the backend API token endpoint
          const response = await axios.post(`${baseURL}/auth/oidc/token-exchange`, {
            code,
            state,
            redirectUri: `${window.location.origin}/auth/callback`
          });
          
          console.log('Token exchange successful');
          
          if (response.data && response.data.data && response.data.data.token) {
            const token = response.data.data.token;
            
            // Store auth token
            localStorage.setItem('adminToken', token);
            localStorage.setItem('isAdminAuthenticated', 'true');
            localStorage.setItem('authToken', token);
            localStorage.setItem('authTimestamp', Date.now().toString());
            
            // Apply token to axios default headers for subsequent requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            // Get the stored redirect URL if any
            const redirectUrl = localStorage.getItem('oidcRedirectUrl') || '/admin/dashboard';
            localStorage.removeItem('oidcRedirectUrl'); // Clean up
            
            // Make sure we're handling the redirect URL properly
            console.log('Original redirect URL:', redirectUrl);
            
            // Ensure we're using a relative path for react-router-dom navigation
            let parsedRedirectUrl = redirectUrl;
            if (parsedRedirectUrl.startsWith('http')) {
              try {
                // Extract just the path portion from the full URL
                const url = new URL(parsedRedirectUrl);
                // Only use the pathname and any search parameters or hash
                parsedRedirectUrl = url.pathname + url.search + url.hash;
                console.log('Parsed redirect URL to path:', parsedRedirectUrl);
              } catch (error) {
                console.error('Error parsing redirect URL:', error);
                // Fallback to dashboard if we can't parse the URL
                parsedRedirectUrl = '/admin/dashboard';
              }
            }
            
            // Ensure the URL starts with a / for react-router-dom
            if (!parsedRedirectUrl.startsWith('/')) {
              parsedRedirectUrl = '/' + parsedRedirectUrl;
            }
            
            console.log('Final redirect URL:', parsedRedirectUrl);
            
            // Redirect after a short delay
            setTimeout(() => {
              navigate(parsedRedirectUrl, { replace: true });
            }, 300);
          } else {
            throw new Error('No token received from backend');
          }
        } catch (exchangeError: any) {
          console.error('Error exchanging code for token:', exchangeError);
          console.log('Error response data:', exchangeError.response?.data);
          console.log('Error status:', exchangeError.response?.status);
          
          setError(exchangeError.response?.data?.message || exchangeError.message || 'Failed to authenticate with the identity provider');
          localStorage.setItem('authError', exchangeError.response?.data?.message || exchangeError.message || 'Failed to authenticate with the identity provider');
          setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
        }
      } catch (err: any) {
        console.error('Error processing OIDC callback:', err);
        setError(err.message || 'Failed to process authentication');
        localStorage.setItem('authError', err.message || 'Failed to process authentication');
        setTimeout(() => navigate('/admin/login', { replace: true }), 2000);
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [navigate, location]);

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh"
      padding={4}
    >
      {processing ? (
        <>
          <CircularProgress size={60} thickness={4} />
          <Typography variant="h6" marginTop={3}>
            Processing authentication...
          </Typography>
        </>
      ) : error ? (
        <Typography variant="h6" color="error">
          {error}
        </Typography>
      ) : (
        <Typography variant="h6">
          Authentication successful! Redirecting...
        </Typography>
      )}
    </Box>
  );
};

export default OIDCCallback; 