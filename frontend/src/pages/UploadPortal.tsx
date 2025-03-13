import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Paper, 
  Container,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Alert,
  Toolbar,
  Link,
  AppBar,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Dashboard } from '@uppy/react';
import Uppy from '@uppy/core';
import Tus from '@uppy/tus';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getUploadLink } from '../services/uploadService';
import { ApiResponse } from '../types';
import { UPLOAD_ENDPOINT_URL, NAMEFORUPLOADCOMPLETION } from '../config';

const StyledDashboard = styled(Box)(({ theme }) => ({
  '& .uppy-Dashboard-inner': {
    width: '100%',
    maxWidth: '100%',
    height: '470px',
  },
  '& .uppy-Dashboard-AddFiles': {
    border: `2px dashed ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
  },
  '& .uppy-Dashboard-AddFiles:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
  '& .uppy-Dashboard-dropFilesHereHint': {
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
}));

// Array of accent colors
const accentColors = [
  '#1d70b8', // Blue
  '#4c2c92', // Purple
  '#d53880', // Pink
  '#f47738', // Orange
  '#00703c', // Green
  '#5694ca', // Light blue
  '#912b88', // Magenta
  '#85994b', // Olive
  '#28a197', // Turquoise
];

// Rainbow flag component
const RainbowFlag = () => (
  <span role="img" aria-label="Rainbow flag" style={{ fontSize: '32px', marginRight: '8px' }}>
    🏳️‍🌈
  </span>
);

const StyledAppBar = styled(AppBar)(() => ({
  backgroundColor: '#0b0c0c',
  color: '#ffffff',
}));

// Interface for API response data
interface UploadLinkResponse {
  clientName: string;
  projectName: string;
  expiresAt: string;
}

// Main upload portal for clients (standalone page not requiring authentication)
const UploadPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<UploadLinkResponse | null>(null);
  const [uppy, setUppy] = useState<any>(null);
  const [accentColor, setAccentColor] = useState('#1d70b8');
  
  useEffect(() => {
    // Select a random accent color on component mount
    const randomColor = accentColors[Math.floor(Math.random() * accentColors.length)];
    setAccentColor(randomColor);

    // Validate the upload token and get project information
    const validateToken = async () => {
      if (!token) {
        setError('Missing upload token');
        setLoading(false);
        return;
      }
      
      try {
        const response = await getUploadLink(token);
        if (response.status === 'success') {
          // The API returns data in this format directly
          // We need to cast it to any to avoid TypeScript errors
          const data = response.data as any;
          
          setProjectInfo({
            clientName: data.clientName,
            projectName: data.projectName,
            expiresAt: data.expiresAt
          });
          
          // Initialize Uppy with the token in metadata
          const uppyInstance = new Uppy({
            id: 'clientUploader',
            autoProceed: true,
            allowMultipleUploadBatches: true,
            debug: true, // Enable debug for troubleshooting
            restrictions: {
              maxFileSize: 640000000000, // 640GB (ProRes files can be very large)
              maxNumberOfFiles: 1000,
              // Allow all file types - this service is for all files
            },
            meta: {
              // Set global metadata that will apply to all files
              client: data.clientName,
              project: data.projectName,
              token: token
            },
            locale: {
              strings: {
                // Customize the "Complete" text to the requested message
                complete: `Your upload was successful and ${NAMEFORUPLOADCOMPLETION} has received it successfully 😌`
              },
              pluralize: (n) => {
                if (n === 1) {
                  return 0;
                }
                return 1;
              }
            }
          }).use(Tus, {
            endpoint: UPLOAD_ENDPOINT_URL, // Base TUS endpoint
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: 2000 * 1024 * 1024, // 2GB chunks for better reliability
            removeFingerprintOnSuccess: true,
            headers: {
              'X-Requested-With': 'XMLHttpRequest', // Add this header to match the tusd-xhr router
            },
            onBeforeRequest: (req) => {
              // Log the request for debugging
              console.log('Uppy request:', req.getURL(), req.getMethod());
              
              // Log the metadata explicitly for POST requests (initial creation)
              if (req.getMethod() === 'POST') {
                console.log('Uppy metadata being sent:', uppyInstance.getState().meta);
                console.log('Upload-Metadata header:', req.getHeader('Upload-Metadata'));
              }
            },
            onShouldRetry: (err, retryAttempt, options, next) => {
              // Log retry attempts
              console.log('Uppy retry attempt:', retryAttempt, err);
              return next(err);
            },
            // The following metadata is handled automatically by Uppy from the global meta option
            // No need to specify it here again as Uppy will handle it
            limit: 10, // Max number of simultaneous uploads
          });
          
          // Set up error handling
          uppyInstance.on('error', (error: Error) => {
            console.error('Uppy error:', error);
            setError(`Upload error: ${error.message}`);
          });
          
          uppyInstance.on('upload-error', (file: any, error: Error) => {
            if (file) {
              console.error('File error:', file, error);
              setError(`Error uploading ${file.name}: ${error.message}`);
            }
          });
          
          // Add file validation to block .turbosort files
          uppyInstance.on('file-added', (file) => {
            const fileName = file.name || '';
            if (fileName === '.turbosort' || fileName.toLowerCase().endsWith('.turbosort')) {
              setError('Files with .turbosort extension are not allowed');
              uppyInstance.removeFile(file.id);
            }
          });
          
          setUppy(uppyInstance);
        }
      } catch (error) {
        console.error('Failed to validate token:', error);
        setError('This upload link is invalid or has expired. Please contact the project manager for a new link.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
    
    // Clean up Uppy instance on unmount
    return () => {
      if (uppy) {
        uppy.close();
      }
    };
  }, [token]);

  const renderHeader = () => (
    <StyledAppBar position="static">
      <Box sx={{ height: '6px', width: '100%', bgcolor: '#ff00ff', display: 'flex' }}>
        {/* Rainbow stripe colors */}
        <Box sx={{ flex: 1, bgcolor: '#E40303' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#FF8C00' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#FFED00' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#008026' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#004DFF' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#750787' }}></Box>
        {/* Transgender flag colors */}
        <Box sx={{ flex: 1, bgcolor: '#5BCEFA' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#FFFFFF' }}></Box>
        <Box sx={{ flex: 1, bgcolor: '#F5A9B8' }}></Box>
      </Box>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/" color="inherit" underline="none" sx={{ display: 'flex', alignItems: 'center' }}>
            <RainbowFlag />
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
              ColourStream
            </Typography>
          </Link>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ height: '8px', width: '100%', position: 'absolute', bottom: 0, left: 0, backgroundColor: accentColor }} />
      </Toolbar>
    </StyledAppBar>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {renderHeader()}
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Stack spacing={3} alignItems="center">
            <CircularProgress />
            <Typography variant="h6">Validating upload link...</Typography>
          </Stack>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {renderHeader()}
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Upload Link Error
              </Typography>
              <Typography variant="body1" color="text.secondary">
                There was a problem with this upload link. It may have expired, reached its maximum usage limit,
                or contain an invalid token.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  if (!projectInfo || !uppy) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {renderHeader()}
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Alert severity="error" sx={{ mb: 4 }}>
            Failed to load project information.
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {renderHeader()}
      
      <Container maxWidth="lg" sx={{ py: 6, flexGrow: 1 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ 
          color: '#0b0c0c',
          fontFamily: '"GDS Transport", Arial, sans-serif',
          fontWeight: 700,
          marginBottom: '30px'
        }}>
          Upload Files
        </Typography>

        <Paper elevation={3} sx={{ 
          p: 4, 
          mb: 4,
          borderRadius: '0',
          border: '1px solid #b1b4b6'
        }}>
          <Typography variant="body1" sx={{ 
            marginBottom: '30px', 
            fontSize: '19px',
            color: '#0b0c0c'
          }}>
            Upload large video files with automatic resumability.
          </Typography>
          
          <StyledDashboard>
            <Dashboard 
              uppy={uppy}
              showProgressDetails
              showRemoveButtonAfterComplete
              proudlyDisplayPoweredByUppy={false}
              height={400}
              width="100%"
              doneButtonHandler={() => {
                uppy.cancelAll();
              }}
            />
          </StyledDashboard>
        </Paper>
      </Container>
      
      <Box sx={{ marginTop: 'auto', borderTop: '1px solid #b1b4b6', py: 4, bgcolor: '#f3f2f1' }}>
        <Container>
          <Typography variant="body2" color="text.secondary">
            <strong>© {new Date().getFullYear()} ColourStream</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Powered by <Link href="https://github.com/transloadit/uppy" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Uppy</Link> and <Link href="https://github.com/tus/tusd" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Tusd</Link>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default UploadPortal; 