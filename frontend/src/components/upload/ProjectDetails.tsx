import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNew from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import { Project, UploadLink, UploadedFile } from '../../types/upload';
import { getProject, getProjectFiles, downloadFile, deleteUploadLink } from '../../services/uploadService';
import CreateUploadLinkForm from './CreateUploadLinkForm';
import { Link as RouterLink } from 'react-router-dom';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import Tus from '@uppy/tus';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';
import { UPLOAD_ENDPOINT_URL } from '../../config';

// Define Uppy instance type as any to avoid complex typing issues
type UppyInstance = any;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [selectedUploadLink, setSelectedUploadLink] = useState<UploadLink | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<UploadLink | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uppy] = useState<UppyInstance>(() => new Uppy({
    restrictions: {
      maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
      maxNumberOfFiles: 100,
    },
    autoProceed: false,
    meta: {
      // Ensure these values are always included in metadata
      projectId: projectId,
      projectid: projectId,
      clientId: project?.clientId || 'default_client',
      clientid: project?.clientId || 'default_client'
    },
  }).use(Tus, {
    endpoint: UPLOAD_ENDPOINT_URL,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    chunkSize: 50 * 1024 * 1024, // 50MB chunks for better reliability
    removeFingerprintOnSuccess: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest', // Add custom header to help identify TUS requests
    },
  }));

  const fetchProjectData = async () => {
    if (!projectId) return;
    
    try {
      const [projectResponse, filesResponse] = await Promise.all([
        getProject(projectId),
        getProjectFiles(projectId),
      ]);

      if (projectResponse.status === 'success') {
        setProject(projectResponse.data);
      }

      if (filesResponse.status === 'success') {
        setFiles(filesResponse.data);
      }
    } catch (err) {
      setError('Failed to refresh project data');
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (!projectId) return;
        
        const [projectResponse, filesResponse] = await Promise.all([
          getProject(projectId),
          getProjectFiles(projectId),
        ]);

        if (projectResponse.status === 'success') {
          setProject(projectResponse.data);
        } else {
          setError('Project not found');
        }

        if (filesResponse.status === 'success') {
          setFiles(filesResponse.data);
        }
      } catch (err) {
        setError('Failed to fetch project data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [projectId]);

  useEffect(() => {
    const completeHandler = (result: any) => {
      // Safe check for result.successful
      if (result && result.successful && result.successful.length > 0) {
        fetchProjectData();
      }
    };

    uppy.on('complete', completeHandler);

    return () => {
      uppy.off('complete', completeHandler);
      // Use cancelAll instead of close
      uppy.cancelAll();
    };
  }, [uppy]);

  useEffect(() => {
    if (project && uppy) {
      uppy.setMeta({
        projectId: projectId,
        projectid: projectId,
        clientId: project.clientId,
        clientid: project.clientId
      });
    }
  }, [project, projectId, uppy]);

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(
        `https://upload.colourstream.johnrogerscolour.co.uk/portal/${link}`
      );
      setCopySuccess(link);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setError('Failed to copy link');
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const blob = await downloadFile(fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  const handleLinkCreated = () => {
    setShowCreateLink(false);
    // Refresh project data to get new links
    fetchProjectData();
  };

  const handleUploadLinkSelect = (link: UploadLink) => {
    setSelectedUploadLink(link);
    uppy.setOptions({
      meta: { token: link.token },
    });
    uppy.getPlugin('Tus').setOptions({
      endpoint: `${UPLOAD_ENDPOINT_URL}${link.token}`,
    });
  };

  const handleDeleteUploadLink = async () => {
    if (!linkToDelete) return;
    
    try {
      const response = await deleteUploadLink(linkToDelete.id);
      
      if (response.status === 'success') {
        // Update project data to reflect the deleted link
        if (project && project.uploadLinks) {
          setProject({
            ...project,
            uploadLinks: project.uploadLinks.filter(link => link.id !== linkToDelete.id)
          });
        }
        
        setSuccessMessage('Upload link deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setDeleteDialogOpen(false);
        setLinkToDelete(null);
      } else {
        setError(response.message || 'Failed to delete upload link');
      }
    } catch (err) {
      setError('Failed to delete upload link');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !project) {
    return (
      <Box p={2}>
        <Typography color="error">{error || 'Project not found'}</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Paper elevation={2}>
        <Box p={3}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h5" gutterBottom>
                {project.name}
              </Typography>
              <Typography color="textSecondary" paragraph>
                {project.description}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to={`/upload/clients/${project.clientId}`}
              color="primary"
              variant="outlined"
            >
              Back to Client
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box mt={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Upload Links</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowCreateLink(true)}
          >
            Create Upload Link
          </Button>
        </Box>

        {showCreateLink && (
          <Box mb={3}>
            <CreateUploadLinkForm
              projectId={projectId || ''}
              onSuccess={handleLinkCreated}
              onCancel={() => setShowCreateLink(false)}
            />
          </Box>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        
        {project?.uploadLinks && project.uploadLinks.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Token</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {project.uploadLinks.map((link) => (
                  <TableRow 
                    key={link.id}
                    hover
                    onClick={(event) => {
                      // Prevent selection if clicking on a button with action-button class or its container
                      if (event.currentTarget.querySelector('.action-button')?.contains(event.target as Node)) {
                        return;
                      }
                      // Select this upload link
                      handleUploadLinkSelect(link);
                    }}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                      // Highlight the selected link
                      backgroundColor: selectedUploadLink?.id === link.id ? 'rgba(25, 118, 210, 0.08)' : 'inherit',
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center">
                        {/* Show full token for debugging */}
                        {link.token}
                        <Tooltip title={copySuccess === link.token ? "Copied!" : "Copy link"}>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleCopyLink(link.token);
                            }}
                            className="action-button"
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {link.isActive === false ? (
                        <Chip label="Inactive" color="error" size="small" />
                      ) : new Date(link.expiresAt) < new Date() ? (
                        <Chip label="Expired" color="warning" size="small" />
                      ) : (
                        <Chip label="Active" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {link.usedCount} / {link.maxUses === 0 ? '∞' : link.maxUses}
                    </TableCell>
                    <TableCell>
                      {new Date(link.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box display="flex">
                        <Tooltip title="View Upload Interface">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleUploadLinkSelect(link);
                            }}
                            className="action-button"
                          >
                            <OpenInNew fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Link">
                          <IconButton 
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              setLinkToDelete(link);
                              setDeleteDialogOpen(true);
                            }}
                            className="action-button"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="textSecondary">No upload links created yet</Typography>
        )}
      </Box>

      {selectedUploadLink && (
        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Upload Files
          </Typography>
          <Paper elevation={2}>
            <Box p={3}>
              <Dashboard
                uppy={uppy}
                plugins={['Webcam']}
                width="100%"
                height={450}
                showProgressDetails
                proudlyDisplayPoweredByUppy={false}
              />
            </Box>
          </Paper>
        </Box>
      )}

      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          Uploaded Files
        </Typography>

        {files.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Filename</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Upload Date</TableCell>
                  <TableCell>Hash</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => (
                  <TableRow 
                    key={file.id}
                    hover
                    onClick={(event) => {
                      // Prevent download if clicking on a button or its container
                      if (event.currentTarget.querySelector('.download-button')?.contains(event.target as Node)) {
                        return;
                      }
                      // Download the file
                      handleDownload(file.id, file.filename);
                    }}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      } 
                    }}
                  >
                    <TableCell>{file.filename}</TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={file.hash}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.hash}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Download">
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            handleDownload(file.id, file.filename);
                          }}
                          className="download-button"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box textAlign="center">
            <Typography color="textSecondary">No files uploaded yet</Typography>
          </Box>
        )}
      </Box>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Upload Link</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this upload link?
            {linkToDelete && (
              <>
                <br /><br />
                <strong>Token:</strong> {linkToDelete.token}<br />
                <strong>Status:</strong> {linkToDelete.isActive === false ? 'Inactive' : 'Active'}<br />
                <strong>Usage:</strong> {linkToDelete.usedCount} / {linkToDelete.maxUses === 0 ? '∞' : linkToDelete.maxUses}
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteUploadLink} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectDetails; 