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
// Import AwsS3 instead of AwsS3Multipart
import AwsS3 from '@uppy/aws-s3'; 
// Keep AwsS3Multipart commented or removed if not needed for other flows
// import AwsS3Multipart from '@uppy/aws-s3-multipart'; 
import Dropbox from '@uppy/dropbox';
import GoogleDrivePicker from '@uppy/google-drive-picker';
import type { UppyFile } from '@uppy/core';
import type { AwsS3UploadParameters } from '@uppy/aws-s3';
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
  COMPANION_AWS_ENDPOINT,
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
const SafeDashboard: React.FC<any> = (props) => {
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
  clientCode: string; // Use clientCode
  projectName: string;
  expiresAt: string;
}

// Interface for custom Uppy file metadata
interface CustomFileMeta {
  clientCode?: string;
  project?: string;
  token?: string;
  key?: string; // The generated S3 key we add
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
          // We need to cast it to any to avoid TypeScript errors
          const data = response.data as any;

          // Use clientCode from the response
          setProjectInfo({
            clientCode: data.clientCode,
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
            // Set global metadata using clientCode
            meta: {
              clientCode: data.clientCode, // Store clientCode
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
            console.log('Using AwsS3 plugin for direct-to-S3 uploads via backend presigned URLs');

            // Use the AWS S3 plugin for direct uploads
            // @ts-expect-error - Uppy plugins have complex typings
            uppyInstance.use(AwsS3, {
              // Determine if multipart should be used based on file size (Uppy default is > 100MB)
              shouldUseMultipart: (file) => file.size > 100 * 1024 * 1024, 
              
              // Endpoint on your backend to get upload parameters (presigned URL or multipart details)
              // This reuses the existing /s3-params endpoint logic
              getUploadParameters: async (file) => {
                // Determine if this file will use multipart based on the same logic
                const isMultipart = file.size > 100 * 1024 * 1024;
                console.log(`[getUploadParameters] File: ${file.name}, Size: ${file.size}, Multipart: ${isMultipart}`);
                
                const response = await fetch(`${API_URL}/upload/s3-params/${token}?filename=${encodeURIComponent(file.name)}&multipart=${isMultipart}`);
                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({ message: 'Failed to fetch S3 parameters' }));
                  throw new Error(errorData.message || `Failed to get S3 parameters: ${response.statusText}`);
                }
                const data = await response.json();
                if (data.status !== 'success') {
                   throw new Error(data.message || 'Backend failed to provide S3 parameters');
                }
                
                console.log('[getUploadParameters] Received S3 params from backend:', data);

                if (isMultipart) {
                  // For multipart, return key and uploadId for Uppy AwsS3 to manage
                  return {
                    method: 'POST', // Method for initiating multipart, parts are PUT
                    url: '', // URL is not needed here, Uppy uses signPart
                    fields: {}, // No extra fields needed for S3 multipart init
                    headers: {},
                    key: data.key, 
                    uploadId: data.uploadId, 
                  };
                } else {
                  // For single part upload, return the presigned URL details
                  return {
                    method: 'PUT', // Single part uses PUT
                    url: data.url, // The presigned URL from the backend
                    fields: {}, // No extra fields needed for PUT
                    headers: {
                      // Required for S3 presigned PUT
                      'Content-Type': file.type || 'application/octet-stream' 
                    }, 
                    key: data.key // Include the key for consistency
                  };
                }
              },
              // Endpoint on your backend to get presigned URL for each part (only called if shouldUseMultipart is true)
              signPart: async (file, partData) => {
                 console.log(`[signPart] Requesting signed URL for part: ${partData.partNumber}, key: ${partData.key}, uploadId: ${partData.uploadId}`);
                 const response = await fetch(`${API_URL}/upload/s3-part-params/${token}?uploadId=${partData.uploadId}&key=${encodeURIComponent(partData.key)}&partNumber=${partData.partNumber}`);
                 if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to sign part' }));
                    throw new Error(errorData.message || `Failed to sign part ${partData.partNumber}: ${response.statusText}`);
                 }
                 const data = await response.json();
                 if (data.status !== 'success' || !data.url) {
                    throw new Error(data.message || 'Backend failed to provide signed URL for part');
                 }
                 console.log(`[signPart] Received signed URL for part ${partData.partNumber}`);
                 return { url: data.url };
              },
              // Endpoint on your backend to complete the multipart upload (only called if shouldUseMultipart is true)
              completeMultipartUpload: async (file, { key, uploadId, parts }) => {
                 console.log(`[completeMultipartUpload] Completing: key=${key}, uploadId=${uploadId}, parts=${parts.length}`);
                 const response = await fetch(`${API_URL}/upload/s3-complete/${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, uploadId, parts }),
                 });
                 if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to complete multipart upload' }));
                    throw new Error(errorData.message || `Failed to complete multipart upload: ${response.statusText}`);
                 }
                 const data = await response.json();
                 if (data.status !== 'success') {
                    throw new Error(data.message || 'Backend failed to complete multipart upload');
                 }
                 console.log('[completeMultipartUpload] Completed via backend:', data);
                 // Return the location if available, otherwise null/undefined
                 // This location is used by Uppy internally and in the success event
                 return { location: data.location }; 
              },
              // Endpoint on your backend to abort the multipart upload (only called if shouldUseMultipart is true)
              abortMultipartUpload: async (file, { key, uploadId }) => {
                 console.log(`[abortMultipartUpload] Aborting: key=${key}, uploadId=${uploadId}`);
                 // Note: Uppy expects query params for abort, matching our backend
                 const response = await fetch(`${API_URL}/upload/s3-abort/${token}?key=${encodeURIComponent(key)}&uploadId=${uploadId}`, {
                    method: 'POST', // Backend route uses POST
                 });
                 if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Failed to abort multipart upload' }));
                    // Don't throw error here, Uppy handles cancellation gracefully
                    console.error(errorData.message || `Failed to abort multipart upload: ${response.statusText}`);
                 }
                 console.log('[abortMultipartUpload] Aborted via backend');
              },
              limit: 6, // Number of concurrent part uploads
              retryDelays: [0, 1000, 3000, 5000, 10000], // Retry delays for failed parts
            });

            // Add Dropbox support if enabled (Companion is still needed for non-S3 providers)
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

            // Log all events for uploads to help debug
            uppyInstance.on('upload-success', (file, response) => {
              if (!file) {
                console.error('[upload-success] No file information available.');
                return;
              }

              console.log(`[upload-success] Upload succeeded: ${file.name}`);
              console.log('[upload-success] Response details:', response);

              // For AwsS3, the response body from completeMultipartUpload (or the direct upload)
              // should contain the location. The key is available in file.meta or file.s3UploadParameters.key
              const finalKey = file.s3UploadParameters?.key || file.meta?.key || 'unknown-key';
              const finalLocation = response?.uploadURL || response?.location || 'unknown-location';

              console.log(`[upload-success] Final Key: ${finalKey}, Final Location: ${finalLocation}`);

              // NOTE: We no longer need the /s3-callback endpoint.
              // The database record creation is now handled by the /s3-complete endpoint for multipart
              // or needs to be added for single-part uploads if not already handled.
              // For now, we just log success here. The backend /s3-complete already logs and saves.

              // Example of how you might manually call a different backend endpoint if needed for single-part tracking:
              // if (!file.isRemote && !uppyInstance.plugins.s3?.opts?.shouldUseMultipart(file)) {
              //   // This was a single-part upload, maybe call a specific endpoint?
              //   fetch(`${API_URL}/upload/s3-single-complete/${token}`, { ... });
              // }
            });

            // Enhanced error handling for AwsS3 uploads
              let key = `unknown/${Date.now()}.bin`; // Fallback key
              if (response.uploadURL) {
                try {
                  const url = new URL(response.uploadURL);
                  // Remove leading slash from pathname to get the key
                  key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                  // The key might be URL-encoded, decode it
                  key = decodeURIComponent(key);
                  // Remove the bucket name prefix if the endpoint includes it (common with MinIO paths)
                  const bucketName = S3_BUCKET; // Get bucket name from config
                  if (key.startsWith(`${bucketName}/`)) {
                    key = key.substring(bucketName.length + 1);
                  }
                  console.log('Extracted key from uploadURL for backend callback:', key);
                } catch (e) {
                  console.error('Failed to parse uploadURL to extract key:', e);
                  // Use the key from file.meta if available as a fallback (though it shouldn't be set anymore)
                  key = (file.meta as CustomFileMeta).key || key;
                  console.warn('Using fallback key for backend callback:', key);
                }
              } else {
                 console.warn('uploadURL not found in response, using fallback key.');
                 // Attempt fallback using file.meta just in case, though getKey was removed
                 key = (file.meta as CustomFileMeta).key || key;
              }

              // Notify backend about the successful S3 multipart upload
              fetch(`${API_URL}/upload/s3-callback/${token}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key, // Send the correctly generated key
                  size: file.size || 0,
                  filename: file.name || 'unknown',
                  mimeType: file.type || 'application/octet-stream',
                  // Use a consistent ID format that doesn't include UUID prefixes
                  hash: `multipart-${key.replace(/\//g, '-')}`
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
              const currentPercent = Math.floor((progress.bytesUploaded / progress.bytesTotal) * 100);
              console.log(`Progress for ${file.name}: ${currentPercent}% (${progress.bytesUploaded}/${progress.bytesTotal})`);

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

            // Log upload starts without depending on fileIDs
            uppyInstance.on('upload', (data: any) => {
              console.log('Upload process started');
              console.log('Upload data object:', JSON.stringify({
                // Safely extract only the properties we're interested in
                fileCount: data && typeof data === 'object' ? Object.keys(data).length : 'unknown',
                dataType: typeof data
              }));

              // Try to get file information without using fileIDs
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
          } else if (useS3) {
            // Fall back to regular S3 if Companion is not enabled
            console.log('Using AwsS3 for direct uploads (Companion disabled)');
            console.log('S3 endpoint configured as:', S3_ENDPOINT);

            uppyInstance.use(AwsS3, {
              shouldUseMultipart: false, // Explicitly disable multipart uploads
              limit: 1, // Process one file at a time to avoid issues
              // TypeScript doesn't recognize forcePathStyle directly
              // We'll handle URL style through the S3 configuration in the backend
              getUploadParameters: async (file) => {
                // Log original filename for debugging
                console.log('Original filename before S3 upload:', file.name);

                // Ensure we have valid strings for file names
                const fileName = typeof file.name === 'string' ? file.name : 'unnamed-file';
                // Use clientCode from meta
                const clientCode = file.meta?.clientCode ? String(file.meta.clientCode).replace(/\s+/g, '_') : 'default';
                const projectName = file.meta?.project ? String(file.meta.project).replace(/\s+/g, '_') : 'default';

                // Generate the key using clientCode
                const generatedKey = `${clientCode}/${projectName}/${fileName}`;

                // Set the file meta to include the original name without any modification
                // This prevents Uppy from adding a UUID prefix
                file.meta = {
                  ...file.meta,
                  key: generatedKey, // Use the key generated with clientCode
                  // This prevents the AWS S3 plugin from adding random identifiers to the filename
                  name: fileName
                };

                // Generate a simple URL for debugging
                const requestUrl = `${API_URL}/upload/s3-params/${token}?filename=${encodeURIComponent(fileName)}`;
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
                console.log('S3 key from backend:', data.key); // Backend still generates a key, but we override it

                // Return the complete upload parameters including Content-Type
                return {
                  method: 'PUT',
                  url: data.url,
                  fields: {}, // Empty for PUT operations
                  headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                    // Add cache control to prevent caching issues
                    'Cache-Control': 'no-cache'
                  },
                  // Add the key generated using clientCode to override the default Uppy UUID generation
                  key: generatedKey
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

              // Enhanced logging for debugging
              console.log('Upload successful to S3 - Original file name:', file.name);
              console.log('File metadata:', file.meta);
              console.log('Upload response details:', {
                status: response.status,
                body: response.body,
                uploadURL: response.uploadURL
              });

              // Extract the key from the file metadata (where we stored the correct one)
              const key = (file.meta as CustomFileMeta).key || `unknown/${Date.now()}.bin`; // Use stored key or fallback
              console.log('Using key from file meta for backend callback:', key);

              // Notify the backend about the successful S3 upload
              fetch(`${API_URL}/upload/s3-callback/${token}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key, // Send the correctly generated key
                  size: file.size || 0,
                  filename: file.name, // Use the original filename
                  mimeType: file.type || 'application/octet-stream',
                  // Use a consistent ID format that doesn't include UUID prefixes
                  hash: `direct-${key.replace(/\//g, '-')}`
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
