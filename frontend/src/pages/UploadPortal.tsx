import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useSearchParams } from 'react-router-dom';
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
// Use the standard AwsS3 plugin
import AwsS3 from '@uppy/aws-s3'; 
import Dropbox from '@uppy/dropbox';
import GoogleDrivePicker from '@uppy/google-drive-picker';
import type { UppyFile } from '@uppy/core';
// Import types needed for AwsS3 configuration
import type { AwsS3Part } from '@uppy/aws-s3'; // Use type from aws-s3
// Base Uppy types (Meta, Body) removed as direct import caused issues
import { v4 as uuidv4 } from 'uuid'; // Import uuid for fallback key generation
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getUploadLink } from '../services/uploadService';
import { ApiResponse } from '../types';
import {
  UPLOAD_ENDPOINT_URL,
  API_URL,
  NAMEFORUPLOADCOMPLETION,
  S3_ENDPOINT,
  S3_REGION,
  S3_BUCKET,
  COMPANION_URL,
  USE_COMPANION,
  ENABLE_DROPBOX,
  ENABLE_GOOGLE_DRIVE,
  GOOGLE_DRIVE_CLIENT_ID,
  GOOGLE_DRIVE_API_KEY,
  GOOGLE_DRIVE_APP_ID
} from '../config';

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

// Safe Dashboard wrapper to handle potential errors
// Define proper props type for SafeDashboard
interface SafeDashboardProps {
  uppy: Uppy<CustomFileMeta, Record<string, never>>;
  [key: string]: any; // For other Dashboard props
}

const SafeDashboard: React.FC<SafeDashboardProps> = (props) => {
  // Save a reference to the uppy instance
  const uppyRef = React.useRef(props.uppy);

  // Add safety monkey patches to prevent fileIDs undefined errors
  React.useEffect(() => {
    if (uppyRef.current) {
      // Store the original upload method
      const originalUpload = uppyRef.current.upload;

      // Replace with a safer version
      uppyRef.current.upload = function() {
        try {
          // @ts-ignore
          return originalUpload.apply(this, arguments);
        } catch (error) {
          console.error('Error in Uppy upload method:', error);
          return Promise.reject(error);
        }
      };

      // Also patch the getFiles method for safety
      const originalGetFiles = uppyRef.current.getFiles;
      uppyRef.current.getFiles = function() {
        try {
          // @ts-ignore
          return originalGetFiles.apply(this, arguments);
        } catch (error) {
          console.error('Error in Uppy getFiles method:', error);
          return [];
        }
      };
    }
  }, []);

  // Render the Dashboard component with the original props
  try {
    return <Dashboard {...props} />;
  } catch (error) {
    console.error('Error rendering Dashboard:', error);
    return <Typography color="error">Error rendering upload interface. Please refresh the page.</Typography>;
  }
};

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

// Rainbow flag component - Ensure it's a valid React Functional Component
const RainbowFlag: React.FC = () => (
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
  clientCode: string; // Use clientCode
  projectName: string;
  expiresAt: string;
}

// Interface for the expected response from the completeMultipartUpload backend endpoint
interface S3CompleteResponse {
  location: string;
}

// Interface for custom Uppy file metadata
interface CustomFileMeta {
  clientCode?: string;
  project?: string;
  token?: string;
  key?: string; // The generated S3 key we add
  // Add index signature to satisfy Uppy's Meta constraint
  [key: string]: any;
}

// Main upload portal for clients (standalone page not requiring authentication)
const UploadPortal: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // --- Move state declarations outside useEffect ---
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<UploadLinkResponse | null>(null);
  const [uppy, setUppy] = useState<Uppy<CustomFileMeta, Record<string, never>> | null>(null); // Use correct Uppy generic type
  const [accentColor, setAccentColor] = useState('#1d70b8');
  // --- End moved state declarations ---
  const useS3 = searchParams.get('S3') === 'true';
  const lastProgressUpdateRef = React.useRef<number>(0); // Timestamp of the last update sent
  const lastPercentageUpdateRef = React.useRef<number>(0); // Last percentage milestone reported
  const MIN_PROGRESS_UPDATE_INTERVAL = 3000; // Minimum ms between updates (e.g., 3 seconds)
  const PERCENTAGE_UPDATE_THRESHOLD = 5; // Send update every X percent increase (e.g., 5%)

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
          // We need to extract the fields we need from the response
          const data = response.data;

          // Create our UploadLinkResponse from the API data
          const uploadLinkResponse: UploadLinkResponse = {
            clientCode: data.project?.client?.code || 'default',
            projectName: data.project?.name || 'default',
            expiresAt: data.expiresAt
          };

          setProjectInfo(uploadLinkResponse);

          // Initialize Uppy with the token in metadata and correct generic types
          const uppyInstance = new Uppy<CustomFileMeta, Record<string, never>>({ // Ensure generics match state type
            id: 'clientUploader',
            autoProceed: false, // Require user to click upload button
            allowMultipleUploadBatches: true,
            debug: true, // Enable debug for troubleshooting
            restrictions: {
              maxFileSize: 640000000000, // 640GB (ProRes files can be very large)
              maxNumberOfFiles: 1000,
              // Allow all file types - this service is for all files
            },
            // Set global metadata using clientCode
            meta: {
              clientCode: uploadLinkResponse.clientCode, // Store clientCode
              project: uploadLinkResponse.projectName,
              token: token
            },
            locale: {
              strings: {
                // Customize the "Complete" text to the requested message
                complete: `Your upload was completed and ${NAMEFORUPLOADCOMPLETION} has received it successfully 😌`
              },
              pluralize: (n) => {
                if (n === 1) {
                  return 0;
                }
                return 1;
              }
            }
          });

          // --- Configure AwsS3 plugin for direct uploads with backend signing ---
          // console.log('Configuring AwsS3 plugin for direct S3 uploads via backend signing'); // Removed confusing log
          uppyInstance.use(AwsS3, {
            // Determine multipart based on size (default is > 100MB)
            shouldUseMultipart: (file) => file.size ? file.size > 100 * 1024 * 1024 : false,
            // Limit concurrent uploads (adjust as needed)
            limit: 5, 
            
            // --- Signing functions pointing to backend ---
            
            // Function to initiate multipart upload
            createMultipartUpload: async (file) => {
              console.log('[AwsS3] createMultipartUpload called for:', file.name);
              const response = await fetch(`${API_URL}/upload/s3/multipart/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filename: file.name,
                  contentType: file.type,
                  metadata: file.meta // Send all file metadata (includes token, clientCode, project)
                }),
              });
              if (!response.ok) {
                const errorText = await response.text();
                console.error('[AwsS3] createMultipartUpload failed:', response.status, errorText);
                throw new Error(`Failed to create multipart upload: ${response.status} ${errorText}`);
              }
              const data = await response.json();
              console.log('[AwsS3] createMultipartUpload response:', data);
              // Store the key in file.meta for subsequent requests
              uppyInstance.setFileMeta(file.id, { key: data.data.key }); 
              // Expected response: { key: string, uploadId: string }
              return data.data; 
            },
            
            // Function to get presigned URLs for parts
            signPart: async (file, partData) => {
              console.log('[AwsS3] signPart called for:', file.name, 'partNumber:', partData.partNumber);
              const response = await fetch(`${API_URL}/upload/s3/multipart/sign-part`, { // Changed endpoint name
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  key: file.meta.key, // Use the key stored in meta
                  uploadId: partData.uploadId,
                  partNumber: partData.partNumber,
                  metadata: file.meta // Send all file metadata
                }),
              });
              if (!response.ok) {
                const errorText = await response.text();
                console.error('[AwsS3] signPart failed:', response.status, errorText);
                throw new Error(`Failed to sign part: ${response.status} ${errorText}`);
              }
              const data = await response.json();
              console.log('[AwsS3] signPart response:', data);
              // Expected response: { url: string }
              return data.data; 
            },

            // Function to abort multipart upload
            abortMultipartUpload: async (file, { key, uploadId }) => {
              console.log('[AwsS3] abortMultipartUpload called for:', file.name, key, uploadId);
              const response = await fetch(`${API_URL}/upload/s3/multipart/abort`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  key: key, 
                  uploadId: uploadId,
                  metadata: file.meta // Send all file metadata
                }),
              });
              if (!response.ok) {
                 const errorText = await response.text();
                 console.error('[AwsS3] abortMultipartUpload failed:', response.status, errorText);
                 // Don't throw here, as abort should ideally succeed silently if possible
              }
              console.log('[AwsS3] abortMultipartUpload completed for:', key);
            },

            // Function to complete multipart upload
            completeMultipartUpload: async (file, { key, uploadId, parts }) => {
              console.log('[AwsS3] completeMultipartUpload called for:', file.name, key, uploadId);
              const response = await fetch(`${API_URL}/upload/s3/multipart/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  key: key,
                  uploadId: uploadId,
                  parts: parts,
                  metadata: file.meta // Send all file metadata
                }),
              });
              if (!response.ok) {
                const errorText = await response.text();
                console.error('[AwsS3] completeMultipartUpload failed:', response.status, errorText);
                throw new Error(`Failed to complete multipart upload: ${response.status} ${errorText}`);
              }
              const data = await response.json();
              console.log('[AwsS3] completeMultipartUpload response:', data);
              // Expected response: { location: url }
              return data.data; 
            },
            
            // listParts is optional, only needed for resuming uploads
            listParts: async (file, { key, uploadId }) => {
              console.log('[AwsS3] listParts called for:', file.name, key, uploadId);
              // This is a placeholder implementation - you can implement this if needed
              return { parts: [] };
            }
          });

          // --- Configure Companion-based providers (Dropbox, Google Drive) ---
          // These still require Companion
          console.log('Configuring Dropbox/Google Drive.');
          // Add Dropbox support if enabled
          if (ENABLE_DROPBOX) {
            console.log('Enabling Dropbox integration');
            uppyInstance.use(Dropbox, {
              companionUrl: COMPANION_URL,
            });
          }

          // Add Google Drive support if enabled
          if (ENABLE_GOOGLE_DRIVE) {
            console.log('Enabling Google Drive Picker integration');
            uppyInstance.use(GoogleDrivePicker, {
              companionUrl: COMPANION_URL,
              clientId: GOOGLE_DRIVE_CLIENT_ID,
              apiKey: GOOGLE_DRIVE_API_KEY,
              appId: GOOGLE_DRIVE_APP_ID
            });
          }
          
          // --- Event listeners ---
          // Log all events for uploads to help debug
          uppyInstance.on('upload-success', (file, response) => {
              if (!file) {
                console.error('[upload-success] No file information available.');
                return;
              }

              console.log(`[upload-success] Upload succeeded: ${file.name}`);
              console.log('[upload-success] Response details:', response);

              // When using AwsS3 with backend signing, the response from completeMultipartUpload contains the location
              const finalLocation = response?.body?.location || 'unknown-location'; // Access location safely
              console.log(`[upload-success] Final Location (from backend completeMultipartUpload): ${finalLocation}`);

              // Store the final URL in the file metadata if needed
            });

            // Enhanced error handling for AwsS3 with backend signing
            uppyInstance.on('upload-error', (file, error, response) => {
              console.error('MULTIPART UPLOAD ERROR:');
              console.error('File:', file?.name, file?.size, file?.type);
              console.error('Error message:', error?.message);

              if (response) {
                console.error('Response status:', response.status);
                try {
                  console.error('Response details:', JSON.stringify(response, null, 2));
                } catch (e) {
                  console.error('Could not stringify response');
                }
              }

              setError(`Error uploading ${file?.name || 'unknown file'}: ${error?.message || 'Unknown error'}`);
            });

            // Add specific logging for chunk uploads to debug performance
            uppyInstance.on('upload-progress', (file, progress) => {
              if (!file || !file.name) return;
              if (progress.bytesTotal === null || progress.bytesUploaded === null) {

              // Throttle progress updates based on time AND percentage change
              const now = Date.now();
              const timeSinceLastUpdate = now - lastProgressUpdateRef.current;
              const percentageIncrease = currentPercent - lastPercentageUpdateRef.current;

              // Send update if minimum time passed AND (significant percentage increase OR upload is complete)
              // Also ensure we send the very first update (percentageIncrease will be >= threshold initially)
              // And ensure we don't send updates for 0% unless it's the very first one.
              const shouldSendUpdate = timeSinceLastUpdate >= MIN_PROGRESS_UPDATE_INTERVAL &&
                                       (percentageIncrease >= PERCENTAGE_UPDATE_THRESHOLD || currentPercent === 100) &&
                                       (currentPercent > 0 || lastPercentageUpdateRef.current === 0); // Allow first 0% update

              if (shouldSendUpdate) {
                lastProgressUpdateRef.current = now; // Update time timestamp
                // Only update the percentage ref if it's not 100% to allow the final 100% message through
                if (currentPercent < 100) {
                    lastPercentageUpdateRef.current = currentPercent; // Update percentage timestamp
                }


                console.log(`Sending progress update for ${file.name} at ${currentPercent}%`);

                // Send progress update to backend
                fetch(`${API_URL}/upload/progress/${token}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    uploadId: file.id, // Use Uppy's file ID
                    bytesUploaded: progress.bytesUploaded,
                    bytesTotal: progress.bytesTotal,
                    filename: file.name,
                    clientName: file.meta?.clientCode, // Use clientCode here too if needed by backend
                    projectName: file.meta?.project,
                  }),
                })
                .then(response => {
                  if (!response.ok) {
                    console.warn(`Backend progress update failed for ${file.name}: ${response.status}`);
                  }
                })
                .catch(error => {
                  console.error(`Error sending progress update for ${file.name}:`, error);
                });
              }
            });

            // Add error logging for debugging upload issues
            uppyInstance.on('error', (error: any) => {
              console.error('Uppy error:', error);
              if (error.request) {
                console.error('Error request URL:', error.request.url);
                console.error('Error request method:', error.request.method);
                console.error('Error status:', error.status);
              }
            });

            // Log when the upload process begins
            uppyInstance.on('upload', (data: { id: string; fileIDs: string[] }) => {
              console.log('Upload process started. Batch ID:', data.id);
              console.log('File IDs in this batch:', data.fileIDs);
              // Log the raw data object for inspection
              console.log('Raw upload event data:', data);

              // Log current files managed by Uppy instance
              try {
                const files = uppyInstance.getFiles();
                if (files && files.length > 0) {
                  console.log(`Current files in Uppy: ${files.length} files`);
                  files.forEach(file => {
                    console.log(`- ${file.name} (${file.size} bytes)`);
                  });
                } else {
                  console.log('No files currently in Uppy');
                }
              } catch (err) {
                console.log('Could not get files from Uppy:', err);
              }
            });

          // Set up general error handling
          uppyInstance.on('error', (error: Error) => {
            console.error('Uppy error:', error);
            setError(`Upload error: ${error.message}`);
          });

          // This is a duplicate handler for 'upload-error' - removing it would be better,
          // but for now we'll just fix the types to match the earlier handler
          uppyInstance.on('upload-error', (file: UppyFile<CustomFileMeta, Record<string, never>>, error: Error, response: Record<string, any>) => {
            if (file) {
              console.error('File error:', file.name, error); // Log filename safely
              console.error('Upload error response:', response);
              // Try to extract more meaningful error details
              let errorMessage = error.message;
              if (response && response.status) {
                errorMessage = `HTTP ${response.status}: ${errorMessage}`;
                if (response.body) {
                  try {
                    const errorBody = typeof response.body === 'string'
                      ? JSON.parse(response.body)
                      : response.body;
                    errorMessage += ` - ${errorBody.message || JSON.stringify(errorBody)}`;
                  } catch (e) {
                    console.error('Failed to parse error body', e);
                    // Add the raw body for debugging
                    errorMessage += ` - Raw body: ${typeof response.body === 'string' ? response.body : '[Object]'}`;
                  }
                }
              }
              // Additional S3-specific error details
              if (error.message === 'Non 2xx' && response) {
                console.error('MinIO S3 error details:', {
                  status: response.status,
                  statusText: response.statusText,
                  url: response.request?.url || 'Unknown URL',
                  headers: response.headers,
                  method: response.method || 'Unknown Method'
                });

                // MinIO specific suggestion
                if (response.status === 403) {
                  errorMessage += ' - This may be a MinIO permissions issue. Check the bucket policy and ACL settings.';
                } else if (response.status === 404) {
                  errorMessage += ' - The specified bucket or object key may not exist in MinIO.';
                } else if (response.status === 400) {
                  errorMessage += ' - Request format may be incorrect for MinIO.';
                }
              }
              setError(`Error uploading ${file.name}: ${errorMessage}`);
            }
          });

          // Add file validation to block .turbosort files
          uppyInstance.on('file-added', (file: UppyFile<CustomFileMeta, Record<string, never>>) => {
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
      // Add null check and use correct close method signature
      if (uppy) {
        uppy.close(); // Remove 'as any' cast
      }
    };
  // Removed useS3 dependency as it's not used anymore
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
            Upload large video files with high-speed direct upload. {useS3 && '(Using S3 storage for native filenames)'}
          </Typography>

          <StyledDashboard>
            <SafeDashboard
              uppy={uppy}
              showProgressDetails
              showRemoveButtonAfterComplete
              proudlyDisplayPoweredByUppy={false}
              height={400}
              width="100%"
              // Removed doneButtonHandler to use default behavior
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
            Powered by <Link href="https://github.com/transloadit/uppy" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Uppy</Link> and <Link href="https://min.io/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>MinIO</Link>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default UploadPortal;
                console.log(`Progress for ${file.name}: bytes information unavailable`);
                return;
              const timeSinceLastUpdate = now - lastProgressUpdateRef.current;
              const percentageIncrease = currentPercent - lastPercentageUpdateRef.current;

              // Send update if minimum time passed AND (significant percentage increase OR upload is complete)
              // Also ensure we send the very first update (percentageIncrease will be >= threshold initially)
              // And ensure we don't send updates for 0% unless it's the very first one.
              const shouldSendUpdate = timeSinceLastUpdate >= MIN_PROGRESS_UPDATE_INTERVAL &&
                                       (percentageIncrease >= PERCENTAGE_UPDATE_THRESHOLD || currentPercent === 100) &&
                                       (currentPercent > 0 || lastPercentageUpdateRef.current === 0); // Allow first 0% update

              if (shouldSendUpdate) {
                lastProgressUpdateRef.current = now; // Update time timestamp
                // Only update the percentage ref if it's not 100% to allow the final 100% message through
                if (currentPercent < 100) {
                    lastPercentageUpdateRef.current = currentPercent; // Update percentage timestamp
                }


                console.log(`Sending progress update for ${file.name} at ${currentPercent}%`);

                // Send progress update to backend
                fetch(`${API_URL}/upload/progress/${token}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    uploadId: file.id, // Use Uppy's file ID
                    bytesUploaded: progress.bytesUploaded,
                    bytesTotal: progress.bytesTotal,
                    filename: file.name,
                    clientName: file.meta?.clientCode, // Use clientCode here too if needed by backend
                    projectName: file.meta?.project,
                  }),
                })
                .then(response => {
                  if (!response.ok) {
                    console.warn(`Backend progress update failed for ${file.name}: ${response.status}`);
                  }
                })
                .catch(error => {
                  console.error(`Error sending progress update for ${file.name}:`, error);
                });
              }
            });

            // Add error logging for debugging upload issues
            uppyInstance.on('error', (error: any) => {
              console.error('Uppy error:', error);
              if (error.request) {
                console.error('Error request URL:', error.request.url);
                console.error('Error request method:', error.request.method);
                console.error('Error status:', error.status);
              }
            });

            // Log when the upload process begins
            uppyInstance.on('upload', (data: { id: string; fileIDs: string[] }) => {
              console.log('Upload process started. Batch ID:', data.id);
              console.log('File IDs in this batch:', data.fileIDs);
              // Log the raw data object for inspection
              console.log('Raw upload event data:', data);

              // Log current files managed by Uppy instance
              try {
                const files = uppyInstance.getFiles();
                if (files && files.length > 0) {
                  console.log(`Current files in Uppy: ${files.length} files`);
                  files.forEach(file => {
                    console.log(`- ${file.name} (${file.size} bytes)`);
                  });
                } else {
                  console.log('No files currently in Uppy');
                }
              } catch (err) {
                console.log('Could not get files from Uppy:', err);
              }
            });

          // Set up general error handling
          uppyInstance.on('error', (error: Error) => {
            console.error('Uppy error:', error);
            setError(`Upload error: ${error.message}`);
          });

          // This is a duplicate handler for 'upload-error' - removing it would be better,
          // but for now we'll just fix the types to match the earlier handler
          uppyInstance.on('upload-error', (file: UppyFile<CustomFileMeta, Record<string, never>>, error: Error, response: Record<string, any>) => {
            if (file) {
              console.error('File error:', file.name, error); // Log filename safely
              console.error('Upload error response:', response);
              // Try to extract more meaningful error details
              let errorMessage = error.message;
              if (response && response.status) {
                errorMessage = `HTTP ${response.status}: ${errorMessage}`;
                if (response.body) {
                  try {
                    const errorBody = typeof response.body === 'string'
                      ? JSON.parse(response.body)
                      : response.body;
                    errorMessage += ` - ${errorBody.message || JSON.stringify(errorBody)}`;
                  } catch (e) {
                    console.error('Failed to parse error body', e);
                    // Add the raw body for debugging
                    errorMessage += ` - Raw body: ${typeof response.body === 'string' ? response.body : '[Object]'}`;
                  }
                }
              }
              // Additional S3-specific error details
              if (error.message === 'Non 2xx' && response) {
                console.error('MinIO S3 error details:', {
                  status: response.status,
                  statusText: response.statusText,
                  url: response.request?.url || 'Unknown URL',
                  headers: response.headers,
                  method: response.method || 'Unknown Method'
                });

                // MinIO specific suggestion
                if (response.status === 403) {
                  errorMessage += ' - This may be a MinIO permissions issue. Check the bucket policy and ACL settings.';
                } else if (response.status === 404) {
                  errorMessage += ' - The specified bucket or object key may not exist in MinIO.';
                } else if (response.status === 400) {
                  errorMessage += ' - Request format may be incorrect for MinIO.';
                }
              }
              setError(`Error uploading ${file.name}: ${errorMessage}`);
            }
          });

          // Add file validation to block .turbosort files
          uppyInstance.on('file-added', (file: UppyFile<CustomFileMeta, Record<string, never>>) => {
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
      // Add null check and use correct close method signature
      if (uppy) {
        uppy.close(); // Remove 'as any' cast
      }
    };
  // Removed useS3 dependency as it's not used anymore
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
            Upload large video files with high-speed direct upload. {useS3 && '(Using S3 storage for native filenames)'}
          </Typography>

          <StyledDashboard>
            <SafeDashboard
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
            Powered by <Link href="https://github.com/transloadit/uppy" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Uppy</Link> and <Link href="https://min.io/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>MinIO</Link>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default UploadPortal;
