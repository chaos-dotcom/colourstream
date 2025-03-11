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
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { Project, UploadLink, UploadedFile } from '../../types/upload';
import { getProject, getProjectFiles, downloadFile } from '../../services/uploadService';
import CreateUploadLinkForm from './CreateUploadLinkForm';
import { Link as RouterLink } from 'react-router-dom';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import Tus from '@uppy/tus';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

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
    endpoint: 'https://live.colourstream.johnrogerscolour.co.uk/files/',
    retryDelays: [0, 3000, 5000, 10000, 20000],
    chunkSize: 5 * 1024 * 1024, // 5MB chunks for better reliability
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
        `https://live.colourstream.johnrogerscolour.co.uk/files/${link}`
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
      endpoint: `https://live.colourstream.johnrogerscolour.co.uk/files/${link.token}`,
    });
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

        {project.uploadLinks && project.uploadLinks.length > 0 ? (
          <Grid container spacing={2}>
            {project.uploadLinks.map((link: UploadLink) => (
              <Grid item xs={12} sm={6} md={4} key={link.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle1" component="div">
                        Upload Link
                      </Typography>
                      <Box>
                        <Tooltip title="Copy Link">
                          <IconButton
                            onClick={() => handleCopyLink(link.token)}
                            color={copySuccess === link.token ? 'success' : 'default'}
                          >
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Button
                          variant={selectedUploadLink?.id === link.id ? 'contained' : 'outlined'}
                          color="primary"
                          onClick={() => handleUploadLinkSelect(link)}
                          size="small"
                          sx={{ ml: 1 }}
                        >
                          Select for Upload
                        </Button>
                      </Box>
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Expires: {new Date(link.expiresAt).toLocaleDateString()}
                    </Typography>
                    {link.maxUses && (
                      <Typography variant="body2" color="textSecondary">
                        Usage: {link.usedCount} / {link.maxUses}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box textAlign="center" mb={4}>
            <Typography color="textSecondary">No upload links available</Typography>
          </Box>
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
                  <TableRow key={file.id}>
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
                          onClick={() =>
                            handleDownload(file.id, file.filename)
                          }
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
    </Box>
  );
};

export default ProjectDetails; 