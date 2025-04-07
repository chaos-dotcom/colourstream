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
// Import both Tus and AwsS3 plugins
import Tus from '@uppy/tus'; 
import AwsS3 from '@uppy/aws-s3'; // Re-add AwsS3
import Dropbox from '@uppy/dropbox';
import GoogleDrivePicker from '@uppy/google-drive-picker';
import type { UppyFile } from '@uppy/core';
// Re-add AwsS3 specific types
import type { AwsS3Part } from '@uppy/aws-s3'; // Use type from aws-s3
// Base Uppy types (Meta, Body) removed as direct import caused issues
import { v4 as uuidv4 } from 'uuid'; 
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { getUploadLink } from '../services/uploadService';
import { ApiResponse } from '../types';
import {
  UPLOAD_ENDPOINT_URL,
  API_URL,
  NAMEFORUPLOADCOMPLETION,
  S3_PUBLIC_ENDPOINT,
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
  // Check for the 'tusd' query parameter to decide upload method
  const useTusd = searchParams.get('tusd') === 'true'; 
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
            autoProceed: true, // Require user to click upload button
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

          // --- Conditionally configure upload plugin based on query param ---
          if (useTusd) {
            console.log('Configuring Uppy with Tus plugin');
            // --- Configure Tus plugin ---
            // Use the public URL configured in Traefik (ensure HTTPS)
            const tusdEndpoint = 'https://tusd.colourstream.johnrogerscolour.co.uk/files/'; // Replace with your actual public Tusd URL
            
            uppyInstance.use(Tus, {
              endpoint: tusdEndpoint,
              retryDelays: [0, 1000, 3000, 5000],
              chunkSize: 64 * 1024 * 1024,
              // resume: true, // Resume is enabled by default, remove explicit option
              // autoRetry: true, // Removed: Not a valid Tus option, retry is handled by retryDelays
              limit: 5,
              // Get file using ID from request
              onBeforeRequest: (req) => {
                // @ts-ignore - req.file exists but might not be in base HttpRequest type
                const fileId = req.file?.id; 
                if (fileId && uppyInstance) {
                  const file = uppyInstance.getFile(fileId);
                  if (file) {
                     // Ensure metadata values are strings before encoding
                     const clientCode = file.meta.clientCode || '';
                     const project = file.meta.project || '';
                     const tokenMeta = file.meta.token || '';
                     // Ensure file.name is also treated as a string, providing an empty fallback
                     req.setHeader('Metadata', `filename ${btoa(encodeURIComponent(file.name || ''))},filetype ${btoa(encodeURIComponent(file.type || 'application/octet-stream'))},clientCode ${btoa(encodeURIComponent(clientCode))},project ${btoa(encodeURIComponent(project))},token ${btoa(encodeURIComponent(tokenMeta))}`);
                  }
                }
              },
            });
          } else {
             console.log('Configuring Uppy with AwsS3 plugin (direct to MinIO)');
             // --- Configure AwsS3 plugin for direct uploads using temporary credentials ---
             uppyInstance.use(AwsS3, {
               // Force multipart for files > 5MB (S3 minimum part size)
               shouldUseMultipart: (file) => (file.size ?? 0) > 5 * 1024 * 1024,
               // Adjust concurrency based on network/backend capacity
               limit: 20, // Keep the increased limit for S3
               // Use a larger chunk size for S3
               getChunkSize: (file) => {
                 return 64 * 1024 * 1024;
               },
               // --- Use Temporary Credentials for Signing (Backend Endpoint Required) ---
               getTemporarySecurityCredentials: async (options) => {
                 console.log('[AwsS3] Requesting temporary credentials...');
                 try {
                   const currentToken = token; 
                   if (!currentToken) {
                     throw new Error('Upload token is not available for fetching credentials.');
                   }
                   const response = await fetch(`${API_URL}/upload/s3/sts-token`, {
                     method: 'GET', 
                     headers: { 'Authorization': `Bearer ${currentToken}` },
                     signal: options?.signal, 
                   });
                   if (!response.ok) {
                     const errorText = await response.text();
                     console.error('[AwsS3] Failed to fetch temporary credentials:', response.status, errorText);
                     throw new Error(`Failed to fetch temporary credentials: ${response.status} ${errorText}`);
                   }
                   const data = await response.json();
                   console.log('[AwsS3] Received temporary credentials response:', data);
                   if (!data || !data.data || !data.data.credentials || !data.data.bucket || !data.data.region) {
                      console.error('[AwsS3] Invalid temporary credentials structure received from backend:', data);
                      throw new Error('Invalid temporary credentials structure received from backend.');
                   }
                   return data.data;
                 } catch (error) {
                   console.error('[AwsS3] Error in getTemporarySecurityCredentials:', error);
                   throw error;
                 }
               },
               // --- Add minimal multipart handlers to satisfy TS types when using getTemporarySecurityCredentials without Companion ---
               // NOTE: It's assumed Uppy might handle the actual S3 calls internally due to getTemporarySecurityCredentials.
               // These are primarily to satisfy the type checker. If uploads fail, these might need real backend implementations.
               createMultipartUpload: async (file): Promise<{ uploadId: string, key: string }> => {
                 // Use existing key or generate one. Backend signing should ideally determine the final key.
                 const key = file.meta?.key || `${file.meta?.clientCode || 'unknown'}/${file.meta?.project || 'unknown'}/${uuidv4()}-${file.name}`;
                 console.warn(`[AwsS3] Dummy createMultipartUpload called for ${key}. Returning dummy ID.`);
                 // Store the key in file meta if generated here, so other dummies can access it
                 uppyInstance?.setFileMeta(file.id, { key });
                 return { uploadId: `dummy-upload-id-${uuidv4()}`, key: key };
               },
               listParts: async (file, { key, uploadId }): Promise<AwsS3Part[]> => {
                 console.warn(`[AwsS3] Dummy listParts called for key: ${key}, uploadId: ${uploadId}. Returning empty list.`);
                 return []; // Return empty array as per AwsS3Part type
               },
               signPart: async (file, { key, uploadId, partNumber }): Promise<{ url: string, headers?: Record<string, string> }> => {
                 console.warn(`[AwsS3] Dummy signPart called for key: ${key}, uploadId: ${uploadId}, part: ${partNumber}. Returning dummy URL.`);
                 // This URL will likely not work, relies on Uppy using the STS creds internally.
                 const dummyUrl = `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${key}?partNumber=${partNumber}&uploadId=${uploadId}&X-Amz-Signature=dummy-signature`;
                 return { url: dummyUrl };
               },
               abortMultipartUpload: async (file, { key, uploadId }) => {
                 console.warn(`[AwsS3] Dummy abortMultipartUpload called for key: ${key}, uploadId: ${uploadId}.`);
                 // No return value needed
               },
               completeMultipartUpload: async (file, { key, uploadId, parts }) => {
                 console.warn(`[AwsS3] Dummy completeMultipartUpload called for key: ${key}, uploadId: ${uploadId}. Returning estimated location.`);
                 // Estimate location based on key. Uppy might provide the real one in upload-success event.
                 const location = `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${key}`;
                 return { location };
               },
             });
          }
          // --- Configure Companion-based providers (Dropbox, Google Drive) ---
          // These might still be useful if you want cloud sources, but they upload via Companion.
          // Companion would need to be configured to upload to the correct target (Tusd or S3/MinIO).
          // which would then likely need to upload to Tusd or S3 itself.
          // Consider if these are still needed with the Tus approach.
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

              if (useTusd) {
                // Tus response structure
                console.log(`[upload-success] Tus Upload succeeded: ${file.name}`);
                console.log('[upload-success] Tus Response details:', response);
                const uploadURL = response?.uploadURL;
                console.log(`[upload-success] Tus Upload URL: ${uploadURL}`);
                // TODO: Potentially notify backend that Tus upload is complete
              } else {
                // AwsS3 response structure (using temporary credentials, Uppy handles completion)
                // The 'response' object here might be limited after direct S3 upload.
                // Uppy's internal state knows the upload is complete.
                // We might not get a specific 'location' back in this exact event handler
                // when using getTemporarySecurityCredentials, as Uppy manages the final S3 CompleteMultipartUpload call.
                console.log(`[upload-success] S3 Upload succeeded: ${file.name}`);
                console.log('[upload-success] S3 Response details (may be limited):', response);
                // The final location is implicitly known based on the generated key (file.meta.key)
                // which would have been determined during the credential fetching or upload process.
                // If you need the exact final URL confirmed, you might need another mechanism
                // or rely on the key generation logic.
                const finalLocation = `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${file.meta.key || file.name}`; // Best guess
                console.log(`[upload-success] S3 Final Location (estimated): ${finalLocation}`);
              }
            });
            
            // Log overall progress (bytes uploaded / total)
            uppyInstance.on('progress', (progress) => {
              // This logs the percentage completion of the entire batch
              console.log('[Uppy Progress]', `Total batch progress: ${progress}%`);
            });

            // Log restriction failures
            uppyInstance.on('restriction-failed', (file, error) => {
              console.error('[Uppy Restriction Failed]', `File: ${file?.name}, Error: ${error.message}`);
              setError(`File restriction error for ${file?.name}: ${error.message}`);
            });

            // Enhanced error handling for AwsS3 with backend signing
            uppyInstance.on('upload-error', (file, error, response) => {
              console.error('MULTIPART UPLOAD ERROR:');
              console.error('File:', file?.name, file?.size, file?.type);
              console.error('Error message:', error?.message);
              // Log part number if available in the error object (Uppy might add this)
              if ((error as any)?.partNumber) {
                console.error('Failed part number:', (error as any).partNumber);
              }

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
              if (!file || !file.name || progress.bytesTotal === null || progress.bytesUploaded === null) {
                 console.log(`Progress for ${file?.name || 'unknown file'}: bytes information unavailable`);
                 return; // Exit if essential progress info is missing
              }

              // Calculate current percentage
              const currentPercent = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);

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
            // Correct signature: (uploadID: string, files: UppyFile[]) => void
            uppyInstance.on('upload', (uploadID: string, files: UppyFile<CustomFileMeta, Record<string, never>>[]) => {
              console.log('Upload process started. Batch ID:', uploadID);
              console.log(`Files in this batch (${files.length}):`, files.map(f => f.name));

              // Log current files managed by Uppy instance (redundant with above, but kept for consistency)
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

          // Set up general error handling (catches broader Uppy errors)
          uppyInstance.on('error', (error) => {
            // Log the error but avoid setting the main error state if upload-error handles specifics
            console.error('[Uppy General Error]', error); 
          });

          // This is a duplicate handler for 'upload-error' - ideally consolidate with the one above
          // Fixing signature to match Uppy's expected type
          uppyInstance.on('upload-error', (file: UppyFile<CustomFileMeta, Record<string, never>> | undefined, error: Error, response?: Record<string, any>) => {
            if (file) {
              console.error('File error:', file.name, error); // Log filename safely
              if (response) {
                console.error('Upload error response:', response);
              } else {
                console.error('Upload error response: undefined (Error might have occurred before response was received or response object was not attached to error)');
              }
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
        // Cast to 'any' as a workaround for persistent TS error
        (uppy as any).close({ reason: 'unmount' });
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
            {useTusd 
              ? 'Upload large video files with highly resumable upload (Tus).' 
              : 'Upload large video files with direct high-speed upload (S3/MinIO).'
            }
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
            Powered by <Link href="https://github.com/transloadit/uppy" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Uppy</Link> 
            {useTusd 
              ? <> and <Link href="https://tus.io/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Tus</Link></>
              : <> and <Link href="https://min.io/" target="_blank" rel="noopener noreferrer" underline="none" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>MinIO</Link></>
            }
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

// Removed duplicated code block from line 720 to 863
// Removed second default export at line 1024

export default UploadPortal; // Add the default export back
