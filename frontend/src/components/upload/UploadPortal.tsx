import React from 'react';
import { Routes, Route, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Breadcrumbs,
  Link,
  Paper,
  Alert,
} from '@mui/material';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import Tus from '@uppy/tus';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { styled } from '@mui/material/styles';
import ClientList from './ClientList';
import CreateClientForm from './CreateClientForm';
import ClientDetails from './ClientDetails';
import ProjectDetails from './ProjectDetails';

// Define proper Uppy instance type - we can just use any for now to avoid complex typing issues
type UppyInstance = any;

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

const FileUploader: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [uppy] = React.useState<UppyInstance>(() => {
    return new Uppy({
      id: 'uppyFileUploader',
      autoProceed: true,
      allowMultipleUploadBatches: true,
      debug: false,
      restrictions: {
        maxFileSize: 64000000000, // 64GB (ProRes files can be very large)
        maxNumberOfFiles: 10,
        // Allow all file types - this service is for all files
      },
    }).use(Tus, {
      endpoint: 'https://live.colourstream.johnrogerscolour.co.uk/files/',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 5 * 1024 * 1024, // 5MB chunks for better reliability
      removeFingerprintOnSuccess: true,
      // Retry parameters are managed via retryDelays
      limit: 5, // Max number of simultaneous uploads
    });
  });

  // Set up error handling
  React.useEffect(() => {
    const errorHandler = (error: Error) => {
      console.error('Uppy error:', error);
      setError(`Upload error: ${error.message}`);
    };

    const fileErrorHandler = (file: any, error: Error) => {
      if (file) {
        console.error('File error:', file, error);
        setError(`Error uploading ${file.name}: ${error.message}`);
      }
    };

    uppy.on('error', errorHandler);
    uppy.on('upload-error', fileErrorHandler);

    return () => {
      uppy.off('error', errorHandler);
      uppy.off('upload-error', fileErrorHandler);
    };
  }, [uppy]);

  return (
    <Box>
      <Box mb={4}>
        <Breadcrumbs>
          <Link component={RouterLink} to="/upload">
            Clients
          </Link>
          <Typography color="text.primary">Upload Files</Typography>
        </Breadcrumbs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          High-Performance File Uploader
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Upload large video files (up to 64GB) with automatic resumability. Supported formats include ProRes, MP4, and MOV.
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
              // Clear all files when done
              uppy.cancelAll();
            }}
          />
        </StyledDashboard>
      </Paper>
    </Box>
  );
};

const UploadPortal: React.FC = () => {
  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ColourStream Upload Portal
          </Typography>
          <Button color="inherit" component={RouterLink} to="/upload">
            Clients
          </Button>
          <Button color="inherit" component={RouterLink} to="/upload/files">
            Upload Files
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Typography color="text.primary">Clients</Typography>
                  </Breadcrumbs>
                </Box>
                <Box mb={3}>
                  <CreateClientForm />
                </Box>
                <ClientList />
              </>
            }
          />
          <Route
            path="/clients/:clientId"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Link component={RouterLink} to="/upload">
                      Clients
                    </Link>
                    <Typography color="text.primary">Client Details</Typography>
                  </Breadcrumbs>
                </Box>
                <ClientDetails />
              </>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <>
                <Box mb={4}>
                  <Breadcrumbs>
                    <Link component={RouterLink} to="/upload">
                      Clients
                    </Link>
                    <Typography color="text.primary">Project Details</Typography>
                  </Breadcrumbs>
                </Box>
                <ProjectDetails />
              </>
            }
          />
          <Route path="/files" element={<FileUploader />} />
        </Routes>
      </Container>
    </Box>
  );
};

export default UploadPortal; 