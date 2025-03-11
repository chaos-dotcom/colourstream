import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as tus from 'tus-js-client';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Cancel as CancelIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';

type UploadStatusType = 'preparing' | 'uploading' | 'paused' | 'completed' | 'error';

interface UploadStatus {
  fileName: string;
  progress: number;
  status: UploadStatusType;
  uploadUrl?: string;
  error?: string;
}

interface UploadInterfaceProps {
  projectId: string;
  clientId?: string;
  onUploadComplete: (fileUrl: string) => void;
  maxFileSize?: number; // in bytes
  allowedFileTypes?: string[];
}

const UploadInterface: React.FC<UploadInterfaceProps> = ({
  projectId,
  clientId = 'default_client',
  onUploadComplete,
  maxFileSize = 64000000000, // 64GB default
  allowedFileTypes = [], // Empty array means all file types are allowed
}) => {
  const [uploads, setUploads] = useState<Record<string, UploadStatus>>({});
  const uploadsRef = useRef<Record<string, tus.Upload>>({});

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds maximum limit of ${maxFileSize / 1000000000}GB`;
    }
    // Only check file types if restrictions are specified
    if (allowedFileTypes.length > 0) {
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedFileTypes.includes(fileExt)) {
        return `File type not allowed. Supported types: ${allowedFileTypes.join(', ')}`;
      }
    }
    return null;
  };

  const handleUpload = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploads(prev => ({
        ...prev,
        [file.name]: {
          fileName: file.name,
          progress: 0,
          status: 'error',
          error,
        },
      }));
      return;
    }

    const upload = new tus.Upload(file, {
      endpoint: 'https://live.colourstream.johnrogerscolour.co.uk/files/',
      retryDelays: [0, 3000, 5000, 10000, 20000],
      metadata: {
        filename: file.name,
        filetype: file.type,
        projectId: projectId.toString(),
        clientId: clientId.toString(),
        projectid: projectId.toString(),
        clientid: clientId.toString(),
      },
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
      chunkSize: 50 * 1024 * 1024, // 50MB chunks
      parallelUploads: 3,
      onError: (error) => {
        console.error(`[Upload Error] ${file.name}:`, error);
        setUploads(prev => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            status: 'error',
            error: error.message,
          },
        }));
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = (bytesUploaded / bytesTotal) * 100;
        setUploads(prev => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            progress: percentage,
          },
        }));
      },
      onSuccess: () => {
        const uploadUrl = upload.url;
        if (uploadUrl) {
          setUploads(prev => ({
            ...prev,
            [file.name]: {
              fileName: file.name,
              progress: 100,
              status: 'completed',
              uploadUrl: uploadUrl,
            },
          }));
          onUploadComplete(uploadUrl);
        }
      },
    });

    uploadsRef.current[file.name] = upload;
    setUploads(prev => ({
      ...prev,
      [file.name]: {
        fileName: file.name,
        progress: 0,
        status: 'preparing',
      },
    }));

    try {
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      await upload.start();
      setUploads(prev => ({
        ...prev,
        [file.name]: {
          ...prev[file.name],
          status: 'uploading',
        },
      }));
    } catch (error) {
      console.error(`[Upload Start Error] ${file.name}:`, error);
      setUploads(prev => ({
        ...prev,
        [file.name]: {
          ...prev[file.name],
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      }));
    }
  }, [projectId, clientId, onUploadComplete, maxFileSize, allowedFileTypes]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => handleUpload(file));
  }, [handleUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: Object.keys(uploads).length > 0,
  });

  const handlePauseResume = (fileName: string) => {
    const upload = uploadsRef.current[fileName];
    if (!upload) return;

    if (uploads[fileName].status === 'uploading') {
      upload.abort();
      setUploads(prev => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          status: 'paused',
        },
      }));
    } else if (uploads[fileName].status === 'paused') {
      upload.start();
      setUploads(prev => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          status: 'uploading',
        },
      }));
    }
  };

  const handleCancel = (fileName: string) => {
    const upload = uploadsRef.current[fileName];
    if (upload) {
      upload.abort();
      delete uploadsRef.current[fileName];
      setUploads(prev => {
        const newUploads = { ...prev };
        delete newUploads[fileName];
        return newUploads;
      });
    }
  };

  const isUploadActive = (status: UploadStatusType): boolean => {
    return ['uploading', 'paused', 'preparing'].includes(status);
  };

  const canPauseResume = (status: UploadStatusType): boolean => {
    return ['uploading', 'paused'].includes(status);
  };

  return (
    <Box>
      <Paper
        {...getRootProps()}
        sx={{
          p: 3,
          textAlign: 'center',
          backgroundColor: isDragActive ? 'action.hover' : 'background.paper',
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          cursor: Object.keys(uploads).length === 0 ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive
            ? 'Drop the files here'
            : Object.keys(uploads).length === 0
            ? 'Drag and drop files here, or click to select'
            : 'Drag and drop more files here'}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {allowedFileTypes.length > 0 ? 
            `Supported formats: ${allowedFileTypes.join(', ')}` : 
            'All file types are supported'}
          <br />
          Maximum file size: {maxFileSize / 1000000000}GB
        </Typography>
      </Paper>

      <Stack spacing={2} sx={{ mt: 3 }}>
        {Object.entries(uploads).map(([fileName, status]) => (
          <Paper key={fileName} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {fileName}
              </Typography>
              {status.status === 'completed' ? (
                <Tooltip title="Upload completed">
                  <SuccessIcon color="success" />
                </Tooltip>
              ) : status.status !== 'error' && (
                <>
                  <IconButton
                    size="small"
                    onClick={() => handlePauseResume(fileName)}
                    disabled={!canPauseResume(status.status)}
                  >
                    {status.status === 'uploading' ? <PauseIcon /> : <ResumeIcon />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleCancel(fileName)}
                    disabled={!isUploadActive(status.status)}
                  >
                    <CancelIcon />
                  </IconButton>
                </>
              )}
            </Box>
            {status.status === 'error' ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {status.error}
              </Alert>
            ) : (
              <>
                <LinearProgress
                  variant="determinate"
                  value={status.progress}
                  sx={{ mb: 1 }}
                />
                <Typography variant="body2" color="textSecondary">
                  {status.status === 'completed'
                    ? 'Upload complete'
                    : status.status === 'paused'
                    ? 'Upload paused'
                    : status.status === 'preparing'
                    ? 'Preparing upload...'
                    : `${Math.round(status.progress)}% uploaded`}
                </Typography>
              </>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default UploadInterface; 