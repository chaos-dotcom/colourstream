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
const RainbowFlag: React.FC = () => { // Use curly braces for explicit return
  return (
    <span role="img" aria-label="Rainbow flag" style={{ fontSize: '32px', marginRight: '8px' }}>
      🏳️‍🌈
    </span>
  );
};

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

          // --- START MOVED UPPY SETUP BLOCK ---
          // Initialize Uppy INSIDE useEffect now
          const uppyInstance = new Uppy<CustomFileMeta, Record<string, never>>({
            id: 'clientUploader',
            autoProceed: true,
            allowMultipleUploadBatches: true,
            debug: true,
            restrictions: {
              maxFileSize: 640000000000,
              maxNumberOfFiles: 1000,
            },
            meta: { // Set metadata using fetched info
              clientCode: uploadLinkResponse.clientCode,
              project: uploadLinkResponse.projectName,
              token: token // Use token from useParams
            },
            locale: {
              strings: {
                complete: `Your upload was completed and ${NAMEFORUPLOADCOMPLETION} has received it successfully 😌`
              },
              pluralize: (n) => n === 1 ? 0 : 1
            }
          });

          // --- Conditionally configure upload plugin based on query param ---
          if (useTusd) { // useTusd is accessible here
            console.log('Configuring Uppy with Tus plugin');
            const tusdEndpoint = 'https://tusd.yourdomain.com/files/'; // Replace with your actual public Tusd URL
            uppyInstance.use(Tus, {
              endpoint: tusdEndpoint,
              retryDelays: [0, 1000, 3000, 5000],
              chunkSize: 64 * 1024 * 1024,
              limit: 5,
              onBeforeRequest: (req) => {
                // @ts-ignore - req.file exists but might not be in base HttpRequest type
                const fileId = req.file?.id;
                if (fileId && uppyInstance) { // uppyInstance is accessible here
                  const file = uppyInstance.getFile(fileId);
                  if (file) {
                    const filename = file.name || '';
                    const filetype = file.type || 'application/octet-stream';
                    const clientCode = file.meta?.clientCode || '';
                    const project = file.meta?.project || '';
                    const tokenMeta = file.meta?.token || '';
                    const metadataPairs = [
                      `filename ${btoa(encodeURIComponent(filename))}`,
                      `filetype ${btoa(encodeURIComponent(filetype))}`,
                      `clientCode ${btoa(encodeURIComponent(clientCode))}`,
                      `project ${btoa(encodeURIComponent(project))}`,
                      `token ${btoa(encodeURIComponent(tokenMeta))}`
                    ];
                    req.setHeader('Metadata', metadataPairs.join(','));
                  }
                }
              },
            });
          } else {
            console.log('Configuring Uppy with AwsS3 plugin (direct to MinIO)');
            uppyInstance.use(AwsS3, {
              getUploadParameters: (file: UppyFile<CustomFileMeta, Record<string, never>>) => {
                console.warn('[AwsS3] Dummy getUploadParameters called unexpectedly!');
                return { method: 'PUT', url: '', fields: {}, headers: {} };
              },
              shouldUseMultipart: (file: UppyFile<CustomFileMeta, Record<string, never>>) => (file.size ?? 0) > 5 * 1024 * 1024,
              limit: 20,
              getChunkSize: (file: UppyFile<CustomFileMeta, Record<string, never>>) => {
                return 64 * 1024 * 1024;
              },
              getTemporarySecurityCredentials: async (options?: { signal?: AbortSignal }) => {
                console.log('[AwsS3] Requesting temporary credentials...');
                try {
                  const currentToken = token; // token is accessible here
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
                  return data.data as { credentials: { AccessKeyId: string; SecretAccessKey: string; SessionToken: string; Expiration?: string | Date; }; bucket: string; region: string; };
                } catch (error) {
                  console.error('[AwsS3] Error in getTemporarySecurityCredentials:', error);
                  throw error;
                }
              },
              createMultipartUpload: async (file: UppyFile<CustomFileMeta, Record<string, never>>): Promise<{ uploadId: string, key: string }> => {
                console.error("Dummy createMultipartUpload called unexpectedly!");
                const key = file.meta?.key || `dummy/${uuidv4()}/${file.name}`;
                return { uploadId: uuidv4(), key: key };
              },
              signPart: async (file: UppyFile<CustomFileMeta, Record<string, never>>, partData: { uploadId: string; key: string; partNumber: number; body: Blob; signal?: AbortSignal }): Promise<{ url: string }> => {
                console.error("Dummy signPart called unexpectedly!");
                const objectKey = file.meta?.key || `dummy/${uuidv4()}/${file.name}`;
                return { url: `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${objectKey}?partNumber=${partData.partNumber}&uploadId=${partData.uploadId}` };
              },
              listParts: async (file: UppyFile<CustomFileMeta, Record<string, never>>, { key, uploadId }: { key: string; uploadId: string; signal?: AbortSignal }): Promise<AwsS3Part[]> => {
                 console.error("Dummy listParts called unexpectedly!");
                 return [];
              },
              abortMultipartUpload: async (file: UppyFile<CustomFileMeta, Record<string, never>>, { key, uploadId }: { key: string; uploadId: string; signal?: AbortSignal }) => {
                 console.error("Dummy abortMultipartUpload called unexpectedly!");
              },
              completeMultipartUpload: async (file: UppyFile<CustomFileMeta, Record<string, never>>, { key, uploadId, parts }: { key: string; uploadId: string; parts: { PartNumber: number; ETag: string }[]; signal?: AbortSignal }) => {
                 console.error("Dummy completeMultipartUpload called unexpectedly!");
                 const objectKey = typeof key === 'string' ? key : (file.meta?.key || `dummy/${uuidv4()}/${file.name}`);
                 const location = `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${objectKey}`;
                 return { location };
              },
            });
          }

          // --- Configure Companion-based providers (Dropbox, Google Drive) ---
          console.log('Configuring Dropbox/Google Drive.');
          if (ENABLE_DROPBOX) {
            console.log('Enabling Dropbox integration');
            uppyInstance.use(Dropbox, { companionUrl: COMPANION_URL });
          }
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
          uppyInstance.on('upload-success', (file, response) => {
              if (!file) { console.error('[upload-success] No file information available.'); return; }
              if (useTusd) { // useTusd is accessible
                console.log(`[upload-success] Tus Upload succeeded: ${file.name}`);
                console.log('[upload-success] Tus Response details:', response);
                const uploadURL = (response as any)?.uploadURL;
                console.log(`[upload-success] Tus Upload URL: ${uploadURL}`);
              } else {
                console.log(`[upload-success] S3 Upload succeeded: ${file.name}`);
                console.log('[upload-success] S3 Response details (may be limited):', response);
                const finalLocation = `${S3_PUBLIC_ENDPOINT}/${S3_BUCKET}/${file.meta.key || file.name}`;
                console.log(`[upload-success] S3 Final Location (estimated): ${finalLocation}`);
              }
            });

            uppyInstance.on('progress', (progress: number) => {
              console.log('[Uppy Progress]', `Total batch progress: ${progress}%`);
            });

            uppyInstance.on('restriction-failed', (file, error) => {
              console.error('[Uppy Restriction Failed]', `File: ${file?.name}, Error: ${error.message}`);
              setError(`File restriction error for ${file?.name}: ${error.message}`); // setError is accessible
            });

            uppyInstance.on('upload-error', (file, error, response) => {
              console.error('MULTIPART UPLOAD ERROR:');
              console.error('File:', file?.name, file?.size, file?.type);
              console.error('Error message:', error?.message);
              if ((error as any)?.partNumber) { console.error('Failed part number:', (error as any).partNumber); }
              if (response) {
                console.error('Response status:', response.status);
                try { console.error('Response details:', JSON.stringify(response, null, 2)); } catch (e) { console.error('Could not stringify response'); }
              }
              setError(`Error uploading ${file?.name || 'unknown file'}: ${error?.message || 'Unknown error'}`); // setError is accessible
            });

            uppyInstance.on('upload-progress', (file, progress) => {
              if (!file || !file.name || progress.bytesTotal === null || progress.bytesUploaded === null) { console.log(`Progress for ${file?.name || 'unknown file'}: bytes information unavailable`); return; }
              const currentPercent = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
              const now = Date.now();
              const timeSinceLastUpdate = now - lastProgressUpdateRef.current; // Refs are accessible
              const percentageIncrease = currentPercent - lastPercentageUpdateRef.current; // Refs are accessible
              const shouldSendUpdate = timeSinceLastUpdate >= MIN_PROGRESS_UPDATE_INTERVAL && // Constants are accessible
                                       (percentageIncrease >= PERCENTAGE_UPDATE_THRESHOLD || currentPercent === 100) &&
                                       (currentPercent > 0 || lastPercentageUpdateRef.current === 0);
              if (shouldSendUpdate) {
                lastProgressUpdateRef.current = now;
                if (currentPercent < 100) { lastPercentageUpdateRef.current = currentPercent; }
                console.log(`Sending progress update for ${file.name} at ${currentPercent}%`);
                fetch(`${API_URL}/upload/progress/${token}`, { // token is accessible
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', },
                  body: JSON.stringify({
                    uploadId: file.id,
                    bytesUploaded: progress.bytesUploaded,
                    bytesTotal: progress.bytesTotal,
                    filename: file.name,
                    clientName: file.meta?.clientCode,
                    projectName: file.meta?.project,
                  }),
                })
                .then(response => { if (!response.ok) { console.warn(`Backend progress update failed for ${file.name}: ${response.status}`); } })
                .catch(error => { console.error(`Error sending progress update for ${file.name}:`, error); });
              }
            });

            uppyInstance.on('error', (error: Error) => {
              console.error('Uppy error:', error);
              if ((error as any).request) {
                console.error('Error request URL:', (error as any).request.url);
                console.error('Error request method:', (error as any).request.method);
                console.error('Error status:', (error as any).status);
              }
            });

            uppyInstance.on('upload', (data: { id: string, fileIDs: string[] }) => {
              console.log('Upload process started. Batch ID:', data.id);
              console.log(`Files in this batch (${data.fileIDs.length}):`, data.fileIDs.map(id => uppyInstance.getFile(id)?.name));
              try {
                const files = uppyInstance.getFiles();
                if (files && files.length > 0) {
                  console.log(`Current files in Uppy: ${files.length} files`);
                  files.forEach(file => { console.log(`- ${file.name} (${file.size} bytes)`); });
                } else { console.log('No files currently in Uppy'); }
              } catch (err) { console.log('Could not get files from Uppy:', err); }
            });

          uppyInstance.on('error', (error) => {
            console.error('[Uppy General Error]', error);
          });

          // REMOVED duplicate upload-error handler

          uppyInstance.on('file-added', (file: UppyFile<CustomFileMeta, Record<string, never>>) => {
            const fileName = file.name || '';
            if (fileName === '.turbosort' || fileName.toLowerCase().endsWith('.turbosort')) {
              setError('Files with .turbosort extension are not allowed'); // setError is accessible
              uppyInstance.removeFile(file.id);
            }
          });

          setUppy(uppyInstance); // Set the state with the configured instance
          // --- END MOVED UPPY SETUP BLOCK ---

        } // End of if (response.status === 'success')
