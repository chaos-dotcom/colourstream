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
import { getClientProjects, getProjectFiles, downloadFile } from '../../services/uploadService';
import CreateUploadLinkForm from './CreateUploadLinkForm';

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

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const [projectResponse, filesResponse] = await Promise.all([
          getClientProjects(projectId!.split('-')[0]),
          getProjectFiles(projectId!),
        ]);

        if (projectResponse.status === 'success') {
          const foundProject = projectResponse.data.find((p) => p.id === projectId);
          if (foundProject) {
            setProject(foundProject);
          } else {
            setError('Project not found');
          }
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

    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(
        `https://upload.colourstream.johnrogerscolour.co.uk/upload/${link}`
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
    if (projectId) {
      fetchProjectData();
    }
  };

  const fetchProjectData = async () => {
    try {
      const [projectResponse, filesResponse] = await Promise.all([
        getClientProjects(projectId!.split('-')[0]),
        getProjectFiles(projectId!),
      ]);

      if (projectResponse.status === 'success') {
        const foundProject = projectResponse.data.find((p) => p.id === projectId);
        if (foundProject) {
          setProject(foundProject);
        }
      }

      if (filesResponse.status === 'success') {
        setFiles(filesResponse.data);
      }
    } catch (err) {
      setError('Failed to refresh project data');
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
              projectId={projectId!}
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
                      <Tooltip title="Copy Link">
                        <IconButton
                          onClick={() => handleCopyLink(link.token)}
                          color={copySuccess === link.token ? 'success' : 'default'}
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Expires: {new Date(link.expiresAt).toLocaleDateString()}
                    </Typography>
                    {link.usageLimit && (
                      <Typography variant="body2" color="textSecondary">
                        Usage: {link.usageCount} / {link.usageLimit}
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
                  <TableCell>Checksum</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>{file.originalFilename}</TableCell>
                    <TableCell>{formatBytes(file.size)}</TableCell>
                    <TableCell>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={file.checksum}>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {file.checksum}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Download">
                        <IconButton
                          onClick={() =>
                            handleDownload(file.id, file.originalFilename)
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