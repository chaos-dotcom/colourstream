import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Container,
  Snackbar,
  Typography,
  Paper,
  Button,
} from '@mui/material';
// Only import icons that are actually used
import { ContentCopy, OpenInNew } from '@mui/icons-material';
import { OBSSettings } from './settings/OBSSettings';
import OIDCSettings from './settings/OIDCSettings';
import OBSControls from './settings/OBSControls';
import {
  InsetText,
} from './GovUkComponents';
import { 
  adminLogout, 
  generateMirotalkToken, 
  TokenGenerationRequest,
  stopOBSStream
} from '../utils/api';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import RoomManagement from './rooms/RoomManagement';
import IPSecurity from './security/IPSecurity';
import PasskeyManagement from './security/PasskeyManagement';
import { OvenMediaConfig } from './OvenMediaConfig';
import ClientList from './upload/ClientList';
import CreateClientForm from './upload/CreateClientForm';
import ProjectDetails from './upload/ProjectDetails';
import AllUploadLinks from '../pages/AllUploadLinks';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState('1d');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [value, setValue] = useState(0);
  const [stoppingStream, setStoppingStream] = useState(false);
  const [forceClientListRefresh, setForceClientListRefresh] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await adminLogout();
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
      setError('Failed to logout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopStream = async () => {
    setStoppingStream(true);
    setError(null);
    try {
      await stopOBSStream();
      setSuccess('OBS stream stopped successfully');
    } catch (error: any) {
      console.error('Failed to stop OBS stream:', error);
      setError(error.response?.data?.message || 'Failed to stop OBS stream. Make sure OBS is connected.');
    } finally {
      setStoppingStream(false);
    }
  };

  const handleCloseTokenDialog = () => {
    setTokenDialogOpen(false);
    setSelectedRoom(null);
    setGeneratedUrl('');
  };

  const handleGenerateToken = async (isPresenter: boolean) => {
    if (!selectedRoom) return;
    
    try {
      setIsGeneratingToken(true);
      setError(null);
      
      const request: TokenGenerationRequest = {
        roomId: selectedRoom.mirotalkRoomId,
        name: tokenName || 'Guest',
        isPresenter,
        expireTime: tokenExpiry
      };
      
      const response = await generateMirotalkToken(request);
      setGeneratedUrl(response.data.url);
      setSuccess(`${isPresenter ? 'Presenter' : 'Guest'} link generated successfully`);
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to generate ${isPresenter ? 'presenter' : 'guest'} link`);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleChange = (_: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleCopy = (text: string, itemName: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccess(`${itemName} copied to clipboard`);
      })
      .catch(() => {
        setError(`Failed to copy ${itemName}`);
      });
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={value} onChange={handleChange} aria-label="admin tabs" variant="scrollable" scrollButtons="auto">
            <Tab label="Rooms" {...a11yProps(0)} />
            <Tab label="OBS" {...a11yProps(1)} />
            <Tab label="Security" {...a11yProps(2)} />
            <Tab label="Settings" {...a11yProps(3)} />
            <Tab label="Upload Clients" {...a11yProps(4)} />
            <Tab label="All Upload Links" {...a11yProps(5)} />
          </Tabs>
        </Box>
        <Box sx={{ padding: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Logout'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <TabPanel value={value} index={0}>
          <Typography variant="h6" gutterBottom component="div">
            Room Management
          </Typography>
          <RoomManagement />
        </TabPanel>
        
        <TabPanel value={value} index={1}>
          <Typography variant="h6" gutterBottom component="div">
            OBS Settings
          </Typography>
          <OBSSettings />
        </TabPanel>

        <TabPanel value={value} index={2}>
          <Typography variant="h6" gutterBottom component="div">
            Security Settings
          </Typography>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              IP Security
            </Typography>
            <IPSecurity />
          </Box>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Passkey Management
            </Typography>
            <PasskeyManagement />
          </Box>
          
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              OIDC Settings
            </Typography>
            <OIDCSettings />
          </Box>
        </TabPanel>
        
        <TabPanel value={value} index={3}>
          <Typography variant="h6" gutterBottom component="div">
            Oven Media Configuration
          </Typography>
          <OvenMediaConfig />
        </TabPanel>

        <TabPanel value={value} index={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Upload Clients</Typography>
              <Button 
                component={RouterLink} 
                to="/upload-links" 
                variant="contained" 
                color="primary"
                startIcon={<OpenInNew />}
              >
                View All Upload Links
              </Button>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CreateClientForm onSuccess={() => {
                // Trigger a refresh of the client list using refreshTrigger
                setForceClientListRefresh(prev => prev + 1);
                console.log('Client created successfully');
              }} />
            </Box>
            <ClientList refreshTrigger={forceClientListRefresh} />
          </Box>
        </TabPanel>

        <TabPanel value={value} index={5}>
          <AllUploadLinks />
        </TabPanel>
      </Box>

      <Dialog open={tokenDialogOpen} onClose={handleCloseTokenDialog} maxWidth="md" fullWidth>
        <DialogTitle>Generate Token Links for {selectedRoom?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Participant Name"
              fullWidth
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              margin="normal"
              placeholder="Enter participant name (optional)"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Token Expiry</InputLabel>
              <Select
                value={tokenExpiry}
                onChange={(e) => setTokenExpiry(e.target.value)}
                label="Token Expiry"
              >
                <MenuItem value="1h">1 Hour</MenuItem>
                <MenuItem value="6h">6 Hours</MenuItem>
                <MenuItem value="12h">12 Hours</MenuItem>
                <MenuItem value="1d">1 Day</MenuItem>
                <MenuItem value="7d">7 Days</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleGenerateToken(true)}
                disabled={isGeneratingToken}
              >
                Generate Presenter Link
              </Button>
              
              <Button
                variant="contained"
                color="secondary"
                onClick={() => handleGenerateToken(false)}
                disabled={isGeneratingToken}
              >
                Generate Guest Link
              </Button>
            </Box>
            
            {isGeneratingToken && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress />
              </Box>
            )}
            
            {generatedUrl && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f3f2f1', borderLeft: '5px solid #1d70b8' }}>
                <Typography variant="subtitle1" gutterBottom>Generated Link:</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    fullWidth
                    value={generatedUrl}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                  <Tooltip title="Copy link">
                    <IconButton onClick={() => handleCopy(generatedUrl, 'Link')}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open in new tab">
                    <IconButton onClick={() => window.open(generatedUrl, '_blank')}>
                      <OpenInNew />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCloseTokenDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
    </Container>
  );
};

export default AdminDashboard; 