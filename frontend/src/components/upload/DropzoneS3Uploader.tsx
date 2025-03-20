import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  Paper, 
  LinearProgress, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Button, 
  Chip, 
  Stack
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import DeleteIcon from '@mui/icons-material/Delete';
import { API_URL } from '../../config';

const DropzoneContainer = styled(Box)(({ theme }) => ({
  cursor: 'pointer',
  padding: theme.spacing(4),
  textAlign: 'center',
  backgroundColor: theme.palette.grey[50],
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: 'border .3s ease-in-out',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
  url?: string;
}

interface DropzoneS3UploaderProps {
  token: string;
  onUploadComplete?: (files: UploadFile[]) => void;
}

const DropzoneS3Uploader: React.FC<DropzoneS3UploaderProps> = ({ token, onUploadComplete }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [projectInfo, setProjectInfo] = useState<{
    clientName: string;
    projectName: string;
  } | null>(null);

  // Fetch project info on mount
  useEffect(() => {
    const fetchProjectInfo = async () => {
      try {
        const response = await axios.get(`${API_URL}/upload/upload-links/${token}`);
        if (response.data.status === 'success') {
          setProjectInfo({
            clientName: response.data.data.clientName,
            projectName: response.data.data.projectName,
          });
        }
      } catch (error) {
        console.error('Failed to fetch project info:', error);
      }
    };

    if (token) {
      fetchProjectInfo();
    }
  }, [token]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true
  });

  const uploadFiles = async () => {
    if (files.length === 0 || isUploading) return;
    
    setIsUploading(true);
    
    const uploadsInProgress = files.filter(f => f.status === 'pending').map(async (fileObj, index) => {
      // Update status to uploading
      setFiles(prev => prev.map((f, i) => 
        f.file.name === fileObj.file.name ? { ...f, status: 'uploading' } : f
      ));
      
      try {
        // Use the traditional form upload endpoint with S3 storage enabled
        const formData = new FormData();
        formData.append('files', fileObj.file);
        // Add query param to specify S3 storage
        const uploadUrl = `${API_URL}/upload/${token}?storage=s3`;
        
        console.log(`Uploading file ${fileObj.file.name} through backend endpoint ${uploadUrl}`);
        
        // Upload through the backend using FormData
        const uploadResponse = await axios.post(uploadUrl, formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setFiles(prev => prev.map((f) => 
                f.file.name === fileObj.file.name ? { ...f, progress: percentCompleted } : f
              ));
            }
          },
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        
        if (uploadResponse.data.status === 'success') {
          // Get the uploaded file details from the response
          const uploadedFile = uploadResponse.data.data[0]; // First file in the array
          
          // Update file status to success
          setFiles(prev => prev.map((f) => 
            f.file.name === fileObj.file.name 
              ? { 
                  ...f, 
                  status: 'success', 
                  url: uploadedFile.url || null, 
                  message: 'Upload complete' 
                } 
              : f
          ));
        } else {
          throw new Error('Upload failed: ' + uploadResponse.data.message || 'Unknown error');
        }
      } catch (error) {
        console.error('Upload failed:', error);
        setFiles(prev => prev.map((f) => 
          f.file.name === fileObj.file.name 
            ? { 
                ...f, 
                status: 'error', 
                message: error instanceof Error ? error.message : 'Upload failed' 
              } 
            : f
        ));
      }
    });
    
    await Promise.all(uploadsInProgress);
    setIsUploading(false);
    
    if (onUploadComplete) {
      onUploadComplete(files);
    }
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(f => f.file.name !== fileName));
  };

  const removeAllFiles = () => {
    setFiles([]);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dropzone S3 Uploader (Alternative)
        </Typography>
        
        {projectInfo && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Uploading to: {projectInfo.clientName} / {projectInfo.projectName}
          </Typography>
        )}
        
        <DropzoneContainer {...getRootProps()}>
          <input {...getInputProps()} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          
          {isDragActive ? (
            <Typography variant="body1">Drop the files here...</Typography>
          ) : (
            <Typography variant="body1">
              Drag & drop files here, or click to select files
            </Typography>
          )}
          
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Simple uploader using backend proxy for S3 storage
          </Typography>
        </DropzoneContainer>
        
        {files.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={uploadFiles} 
                disabled={isUploading || files.every(f => f.status !== 'pending')}
              >
                {isUploading ? 'Uploading...' : 'Upload All Files'}
              </Button>
              
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={removeAllFiles} 
                disabled={isUploading}
              >
                Clear All
              </Button>
            </Stack>
            
            <List>
              {files.map((fileObj, index) => (
                <ListItem key={fileObj.file.name + index} 
                  secondaryAction={
                    fileObj.status !== 'uploading' && (
                      <Button
                        onClick={() => removeFile(fileObj.file.name)}
                        disabled={isUploading}
                        startIcon={<DeleteIcon />}
                      >
                        Remove
                      </Button>
                    )
                  }
                >
                  <ListItemIcon>
                    {fileObj.status === 'success' ? (
                      <CheckCircleIcon color="success" />
                    ) : fileObj.status === 'error' ? (
                      <ErrorIcon color="error" />
                    ) : (
                      <CloudUploadIcon color="primary" />
                    )}
                  </ListItemIcon>
                  
                  <ListItemText 
                    primary={fileObj.file.name} 
                    secondary={
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mr: 2, minWidth: '100px' }}>
                            {(fileObj.file.size / (1024 * 1024)).toFixed(2)} MB
                          </Typography>
                          
                          <Chip 
                            size="small" 
                            label={fileObj.status === 'pending' 
                              ? 'Ready to upload' 
                              : fileObj.status === 'uploading' 
                                ? `Uploading: ${fileObj.progress}%` 
                                : fileObj.status === 'success' 
                                  ? 'Uploaded successfully' 
                                  : fileObj.message || 'Error'
                            }
                            color={
                              fileObj.status === 'success' 
                                ? 'success' 
                                : fileObj.status === 'error' 
                                  ? 'error' 
                                  : 'primary'
                            }
                          />
                        </Box>
                        
                        {fileObj.status === 'uploading' && (
                          <LinearProgress 
                            variant="determinate" 
                            value={fileObj.progress} 
                            sx={{ mt: 1, mb: 1 }} 
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default DropzoneS3Uploader; 