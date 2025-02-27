import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Snackbar,
  Typography,
  Grid,
  Divider,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import { HelpOutline } from '@mui/icons-material';
import { getOIDCConfig, updateOIDCConfig, OIDCConfig } from '../../utils/api';
import { SectionHeading, Button, InsetText, WarningText } from '../GovUkComponents';

const OIDCSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [config, setConfig] = useState<OIDCConfig | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await getOIDCConfig();
      setConfig(response.config);
      setIsInitialized(response.isInitialized);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch OIDC configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof OIDCConfig, value: any) => {
    if (!config) return;
    
    setConfig({
      ...config,
      [field]: value
    });
  };

  const handleSave = async () => {
    if (!config) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const response = await updateOIDCConfig(config);
      setConfig(response.config);
      setIsInitialized(response.isInitialized);
      setSuccess('OIDC configuration saved successfully');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to save OIDC configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      <SectionHeading>OpenID Connect (OIDC) Configuration</SectionHeading>
      
      <InsetText>
        OpenID Connect allows users to authenticate using an external identity provider such as Google, Microsoft, Okta, or Auth0.
        This is optional and can be used alongside passkey authentication.
      </InsetText>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config?.enabled || false}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
            }
            label="Enable OIDC Authentication"
          />
          
          {config?.enabled && !isInitialized && (
            <WarningText>
              OIDC is enabled but not properly initialized. Please check your configuration.
            </WarningText>
          )}
        </Box>
        
        {config && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Provider Name"
                fullWidth
                value={config.providerName || ''}
                onChange={(e) => handleChange('providerName', e.target.value)}
                helperText="Display name for the identity provider (e.g., 'Google', 'Microsoft', 'Okta')"
                disabled={saving}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Client ID"
                fullWidth
                value={config.clientId || ''}
                onChange={(e) => handleChange('clientId', e.target.value)}
                helperText="Client ID provided by your identity provider"
                disabled={saving}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Client Secret"
                fullWidth
                type="password"
                value={config.clientSecret || ''}
                onChange={(e) => handleChange('clientSecret', e.target.value)}
                helperText="Client Secret provided by your identity provider"
                disabled={saving}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                label="Redirect URI"
                fullWidth
                value={config.redirectUri || ''}
                onChange={(e) => handleChange('redirectUri', e.target.value)}
                helperText="URI where the identity provider will redirect after authentication"
                disabled={saving}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">Discovery Configuration</Typography>
                <Tooltip title="You can either use the discovery URL or manually configure the endpoints">
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <HelpOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <TextField
                label="Discovery URL"
                fullWidth
                value={config.discoveryUrl || ''}
                onChange={(e) => handleChange('discoveryUrl', e.target.value)}
                helperText="URL to the OpenID Connect discovery document (e.g., https://accounts.google.com/.well-known/openid-configuration)"
                disabled={saving}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 3, mb: 2 }}>
                <Button
                  variant="secondary"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  type="button"
                >
                  {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                </Button>
                <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                  Only needed if not using discovery URL
                </Typography>
              </Box>
              
              {showAdvanced && (
                <Box sx={{ mt: 2 }}>
                  <Divider sx={{ mb: 3 }} />
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Manual Endpoint Configuration
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Authorization URL"
                        fullWidth
                        value={config.authorizationUrl || ''}
                        onChange={(e) => handleChange('authorizationUrl', e.target.value)}
                        helperText="URL for the authorization endpoint"
                        disabled={saving}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Token URL"
                        fullWidth
                        value={config.tokenUrl || ''}
                        onChange={(e) => handleChange('tokenUrl', e.target.value)}
                        helperText="URL for the token endpoint"
                        disabled={saving}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="User Info URL"
                        fullWidth
                        value={config.userInfoUrl || ''}
                        onChange={(e) => handleChange('userInfoUrl', e.target.value)}
                        helperText="URL for the userinfo endpoint"
                        disabled={saving}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Logout URL"
                        fullWidth
                        value={config.logoutUrl || ''}
                        onChange={(e) => handleChange('logoutUrl', e.target.value)}
                        helperText="URL for the logout endpoint (optional)"
                        disabled={saving}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        label="Scope"
                        fullWidth
                        value={config.scope || 'openid profile email'}
                        onChange={(e) => handleChange('scope', e.target.value)}
                        helperText="Space-separated list of scopes to request"
                        disabled={saving}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Grid>
          </Grid>
        )}
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Configuration'}
          </Button>
        </Box>
      </Paper>
      
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
    </Box>
  );
};

export default OIDCSettings; 