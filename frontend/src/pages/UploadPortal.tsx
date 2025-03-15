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
import Tus from '@uppy/tus';
import XHRUpload from '@uppy/xhr-upload';
import AwsS3 from '@uppy/aws-s3';
import AwsS3Multipart from '@uppy/aws-s3-multipart';
import type { UppyFile } from '@uppy/core';
import type { AwsS3UploadParameters } from '@uppy/aws-s3';
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
  COMPANION_AWS_ENDPOINT,
  USE_COMPANION
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<UploadLinkResponse | null>(null);
  const [uppy, setUppy] = useState<any>(null);
  const [accentColor, setAccentColor] = useState('#1d70b8');
  const useS3 = searchParams.get('S3') === 'true';
  
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

          // Choose upload method based on configuration
          if (USE_COMPANION) {
            console.log('Using AwsS3Multipart with Companion for large file uploads');
            
            // Use the AWS S3 Multipart plugin with Companion for chunked uploads
            // @ts-expect-error - Uppy plugins have complex typings that are difficult to match exactly
            uppyInstance.use(AwsS3Multipart, {
              endpoint: COMPANION_URL,
              headers: {
                'x-upload-token': token
              },
              // Ensure all S3 requests go through Companion instead of directly to MinIO
              companionAllowedHosts: /.*/,  // Force all uploads through Companion
              // Configure chunking for large file support
              limit: 6, // Number of concurrent uploads
              retryDelays: [0, 1000, 3000, 5000, 10000], // Retry delays for failed chunks
              // For very large files, use large chunks to speed up upload
              // This is larger than the default 5MB chunks
              chunkSize: 50 * 1024 * 1024, // 50MB chunks
              // Log progress for debugging
              getChunkSize(file: any) {
                // For smaller files, use smaller chunks
                if (file.size && file.size < 100 * 1024 * 1024) {
                  return 10 * 1024 * 1024; // 10MB chunks for files smaller than 100MB
                }
                // For medium files
                if (file.size && file.size < 1024 * 1024 * 1024) {
                  return 25 * 1024 * 1024; // 25MB chunks for files smaller than 1GB
                }
                // For very large files (like your 600GB files)
                return 50 * 1024 * 1024; // 50MB chunks for very large files
              }
            });
            
            // Log all events for multipart uploads to help debug
            uppyInstance.on('upload-success', (file, response) => {
              if (!file) {
                console.error('No file information available in upload-success event');
                return;
              }
              
              console.log('Multipart upload succeeded:', file.name);
              console.log('Response details:', response);
              
              // Extract key information for callback
              let key;
              if (file.name) {
                // Construct the key using the client/project structure with the clean filename 
                key = `${file.meta?.client ? String(file.meta.client).replace(/\s+/g, '_') : 'default'}/${
                  file.meta?.project ? String(file.meta.project).replace(/\s+/g, '_') : 'default'
                }/${file.name}`;
              } else if (response.uploadURL) {
                // If we have a URL but no filename, extract the key from the URL
                key = response.uploadURL.split('?')[0].split('/').slice(3).join('/');
              } else {
                // Fallback for when we can't determine the key
                key = `unknown/${Date.now()}.bin`;
              }
                
              // Notify backend about the successful S3 multipart upload
              fetch(`${API_URL}/upload/s3-callback/${token}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key,
                  size: file.size || 0,
                  filename: file.name || 'unknown',
                  mimeType: file.type || 'application/octet-stream',
                  hash: 's3-multipart-' + file.id
                })
              })
              .then(response => response.json())
              .then(data => {
                console.log('Backend notified of S3 multipart upload:', data);
              })
              .catch(error => {
                console.error('Error notifying backend about S3 multipart upload:', error);
              });
            });
            
            // Enhanced error handling for multipart uploads
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
                console.log(`Progress for ${file.name}: bytes information unavailable`);
                return;
              }
              const percent = progress.bytesUploaded / progress.bytesTotal * 100;
              console.log(`Progress for ${file.name}: ${percent.toFixed(2)}% (${progress.bytesUploaded}/${progress.bytesTotal})`);
            });
          } 
          // Fall back to regular S3 if Companion is not enabled
          else if (useS3) {
            console.log('Using regular (non-multipart) AWS S3 plugin for direct PUT uploads');
            
            // Use the regular AWS S3 plugin, explicitly disabling multipart uploads
            uppyInstance.use(AwsS3, {
              shouldUseMultipart: false, // Explicitly disable multipart uploads
              limit: 1, // Process one file at a time to avoid issues
              getUploadParameters: async (file) => {
                // Generate a simple URL for debugging
                const requestUrl = `${API_URL}/upload/s3-params/${token}?filename=${encodeURIComponent(file.name || 'unnamed-file')}`;
                console.log('Requesting S3 URL from:', requestUrl);
                
                // Simple fetch to get presigned URL
                const response = await fetch(requestUrl);
                
                if (!response.ok) {
                  console.error('S3 params request failed:', response.status, response.statusText);
                  throw new Error(`S3 params request failed: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.status !== 'success' || !data.url) {
                  console.error('Invalid S3 response:', data);
                  throw new Error('Invalid S3 response from server');
                }
                
                console.log('S3 presigned URL:', data.url);
                
                // Return the complete upload parameters including Content-Type
                return {
                  method: 'PUT',
                  url: data.url,
                  fields: {}, // Empty for PUT operations
                  headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    // Add cache control to prevent caching issues
                    'Cache-Control': 'no-cache'
                  }
                };
              }
            });
            
            // Add event handler for successful uploads to record in the database
            uppyInstance.on('upload-success', (file, response) => {
              // Check that file exists before proceeding
              if (!file || !file.name) {
                console.error('Missing file data in upload-success event');
                return;
              }
              
              console.log('Upload successful to S3:', file.name, response);
              console.log('Response details:', {
                status: response.status,
                body: response.body,
                uploadURL: response.uploadURL
              });
              
              // Extract the key from the upload response or construct it
              // Important: We need to extract just the original filename without any UUID prefix
              let key;
              if (response.uploadURL) {
                // When we get a URL back, extract just the key path from it (after the bucket)
                const urlPath = response.uploadURL.split('?')[0].split('/').slice(3).join('/');
                // If the key has a UUID prefix, strip it out to get clean filenames
                key = urlPath;
              } else {
                // Construct the key using the client/project structure with the clean filename
                key = `${file.meta.client ? file.meta.client.replace(/\s+/g, '_') : 'default'}/${
                      file.meta.project ? file.meta.project.replace(/\s+/g, '_') : 'default'
                    }/${file.name}`;
              }
              
              // Notify the backend about the successful S3 upload
              fetch(`${API_URL}/upload/s3-callback/${token}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key,
                  size: file.size || 0,
                  filename: file.name, // Use the original filename
                  mimeType: file.type || 'application/octet-stream',
                  hash: 's3-' + file.id
                })
              })
              .then(response => response.json())
              .then(data => {
                console.log('Backend notified of S3 upload:', data);
              })
              .catch(error => {
                console.error('Error notifying backend about S3 upload:', error);
              });
            });
            
            // Add specific listener for S3 multipart errors to get more detailed information
            uppyInstance.on('upload-error', (file, error, response) => {
              console.error('UPLOAD ERROR DETAILS:');
              console.error('File:', file?.name, file?.size, file?.type);
              console.error('Error message:', error?.message);
              
              // Try to extract the request details
              if (response) {
                console.error('Response status:', response.status);
                
                // Log all response properties safely using a try/catch to avoid TypeScript errors
                try {
                  console.error('Response details:', JSON.stringify(response, null, 2));
                } catch (e) {
                  console.error('Could not stringify response');
                }
                
                // Log response body if available
                if (response.body) {
                  console.error('Response body:', 
                    typeof response.body === 'string' 
                      ? response.body 
                      : JSON.stringify(response.body, null, 2)
                  );
                }
              }
              
              // Log MinIO specific diagnostic info
              if (error.message === 'Non 2xx' && response) {
                console.error('MinIO S3 error details:', {
                  status: response.status
                });

                // MinIO specific suggestion
                if (response.status === 403) {
                  setError(`Error uploading ${file?.name}: ${error.message} - This may be a MinIO permissions issue. Check the bucket policy and ACL settings.`);
                } else if (response.status === 404) {
                  setError(`Error uploading ${file?.name}: ${error.message} - The specified bucket or object key may not exist in MinIO.`);
                } else if (response.status === 400) {
                  setError(`Error uploading ${file?.name}: ${error.message} - Request format may be incorrect for MinIO.`);
                } else {
                  setError(`Error uploading ${file?.name}: ${error.message}`);
                }
              } else {
                setError(`Error uploading ${file?.name}: ${error.message}`);
              }
            });
          } else {
            // Standard XHR uploader for local storage
            console.log('Using XHRUpload for local storage');
            
            uppyInstance.use(XHRUpload, {
              endpoint: `${API_URL}/upload/upload/${token}`,
              fieldName: 'files', // Must match the field name expected by multer in backend
              formData: true,
              bundle: true,
              limit: 10,
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
              }
            });
            
            console.log('Local storage upload configured');
          }
          
          // Set up error handling
          uppyInstance.on('error', (error: Error) => {
            console.error('Uppy error:', error);
            setError(`Upload error: ${error.message}`);
          });
          
          uppyInstance.on('upload-error', (file: any, error: Error, response: any) => {
            if (file) {
              console.error('File error:', file, error);
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
  }, [token, useS3]);

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
            Powered by <Link href="https://github.com/transloadit/uppy" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Uppy</Link> and <Link href="https://min.io/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>MinIO</Link>
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default UploadPortal; 