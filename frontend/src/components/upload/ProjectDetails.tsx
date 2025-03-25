import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
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
  TextField,
  Divider,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNew from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Project, UploadLink, UploadedFile } from '../../types/upload';
import { ApiResponse } from '../../types';
import { 
  getProject, 
  getProjectFiles, 
  downloadFile, 
  deleteUploadLink,
  setTurbosortDirectory as saveTurbosortDirectory,
  deleteTurbosortDirectory,
  updateProject,
  updateUploadLink,
} from '../../services/uploadService';
import CreateUploadLinkForm from './CreateUploadLinkForm';
import { Link as RouterLink } from 'react-router-dom';

// Define proper types
interface UploadLinkWithSelection extends UploadLink {
  selected?: boolean;
}

// GDS-inspired styles
const gdsStyles = {
  // Card styles
  card: {
    border: '1px solid #b1b4b6',
    borderRadius: '0px',
    boxShadow: 'none',
    backgroundColor: '#ffffff',
  },
  // Table styles
  table: {
    border: '1px solid #b1b4b6',
    borderCollapse: 'collapse',
    width: '100%',
    '& th': {
      backgroundColor: '#f3f2f1',
      fontWeight: 'bold',
      textAlign: 'left',
      padding: '10px',
      borderBottom: '1px solid #b1b4b6',
    },
    '& td': {
      padding: '10px',
      borderBottom: '1px solid #b1b4b6',
      fontSize: '16px',
    },
  },
  tableContainer: {
    boxShadow: 'none',
    border: 'none',
  },
  tableRow: {
    '&:hover': {
      backgroundColor: '#f8f8f8',
    },
  },
  // Button styles
  primaryButton: {
    backgroundColor: '#00703c',
    color: 'white',
    borderRadius: '0',
    fontWeight: 'bold',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: '#005a30',
    },
  },
  secondaryButton: {
    backgroundColor: '#f3f2f1',
    color: '#0b0c0c',
    borderRadius: '0',
    border: '2px solid #0b0c0c',
    fontWeight: 'bold',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: '#dbdad9',
    },
  },
  // Typography
  heading: {
    color: '#0b0c0c',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  caption: {
    color: '#505a5f',
    fontSize: '16px',
  },
  // Status chips
  statusChip: {
    borderRadius: '0',
    fontWeight: 'bold',
    padding: '5px 10px',
  },
};

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
  
  // Turbosort state
  const [turbosortDirectory, setTurbosortDirectory] = useState<string>('');
  const [isEditingTurbosort, setIsEditingTurbosort] = useState(false);
  const [turbosortError, setTurbosortError] = useState<string | null>(null);

  // Project editing state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Upload link editing state
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkToEdit, setLinkToEdit] = useState<UploadLink | null>(null);
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editLinkError, setEditLinkError] = useState<string | null>(null);

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
          // Set turbosort directory if it exists
          if (projectResponse.data.turbosortDirectory) {
            setTurbosortDirectory(projectResponse.data.turbosortDirectory);
          }
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

  const openClientUploadPage = (link: UploadLink) => {
    const uploadUrl = `https://upload.colourstream.johnrogerscolour.co.uk/portal/${link.token}`;
    window.open(uploadUrl, '_blank');
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

  // Handle updating the upload link
  const handleUpdateUploadLink = async () => {
    if (!linkToEdit) return;
    
    try {
      setEditLinkError(null);
      
      // Format the date for the API - Use the value from the date picker
      const data = {
        expiresAt: editExpiresAt
      };
      
      // Import and use the updateUploadLink function
      const response = await updateUploadLink(linkToEdit.id, data);
      
      if (response.status === 'success') {
        // Update project data to reflect the updated link
        if (project && project.uploadLinks) {
          setProject({
            ...project,
            uploadLinks: project.uploadLinks.map(link => 
              link.id === linkToEdit.id ? response.data : link
            )
          });
        }
        
        setSuccessMessage('Upload link updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsEditingLink(false);
        setLinkToEdit(null);
      } else {
        setEditLinkError(response.message || 'Failed to update upload link');
      }
    } catch (err) {
      setEditLinkError('Failed to update upload link');
    }
  };

  // Handle saving turbosort directory
  const handleSaveTurbosortDirectory = async () => {
    if (!projectId) return;
    
    try {
      setTurbosortError(null);
      const response = await saveTurbosortDirectory(projectId, turbosortDirectory);
      
      if (response.status === 'success') {
        // Update project with new turbosort directory
        if (project) {
          setProject({
            ...project,
            turbosortDirectory: turbosortDirectory
          });
        }
        
        setIsEditingTurbosort(false);
        setSuccessMessage('Turbosort directory saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setTurbosortError(response.message || 'Failed to save turbosort directory');
      }
    } catch (err) {
      setTurbosortError('Failed to save turbosort directory');
    }
  };

  // Handle deleting turbosort directory
  const handleDeleteTurbosortDirectory = async () => {
    if (!projectId) return;
    
    try {
      setTurbosortError(null);
      const response = await deleteTurbosortDirectory(projectId);
      
      if (response.status === 'success') {
        // Update project with null turbosort directory
        if (project) {
          setProject({
            ...project,
            turbosortDirectory: null
          });
        }
        
        setTurbosortDirectory('');
        setIsEditingTurbosort(false);
        setSuccessMessage('Turbosort directory removed successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setTurbosortError(response.message || 'Failed to remove turbosort directory');
      }
    } catch (err) {
      setTurbosortError('Failed to remove turbosort directory');
    }
  };

  // Handle updating project name and description
  const handleUpdateProject = async () => {
    if (!projectId) return;
    
    try {
      setEditError(null);
      
      // Only update if there are changes
      if (editName === project?.name && editDescription === project?.description) {
        setIsEditingProject(false);
        return;
      }
      
      const data: { name?: string; description?: string } = {};
      
      // Only include fields that have changed
      if (editName !== project?.name) data.name = editName;
      if (editDescription !== project?.description) data.description = editDescription;
      
      const response = await updateProject(projectId, data);
      
      if (response.status === 'success') {
        setProject(response.data);
        setSuccessMessage('Project updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsEditingProject(false);
      } else {
        setEditError(response.message || 'Failed to update project');
      }
    } catch (err) {
      setEditError('Failed to update project');
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
    <Box p={2} sx={{ maxWidth: '1200px', margin: '0 auto' }}>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}
      
      {/* Project Details Card */}
      <Paper elevation={0} sx={gdsStyles.card}>
        <Box p={4}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
            <Box>
              <Box display="flex" alignItems="baseline" sx={{ mb: 2 }}>
                <Typography variant="h4" component="h1" sx={{ ...gdsStyles.heading, mb: 0, mr: 1 }}>
                  {project.name}
                </Typography>
                <Tooltip title="Edit Project">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      setEditName(project.name);
                      setEditDescription(project.description || '');
                      setIsEditingProject(true);
                    }}
                    sx={{ 
                      color: '#1d70b8',
                      p: '4px',
                      position: 'relative',
                      top: '-2px'
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {project.client && (
                <Typography variant="subtitle1" sx={{ fontSize: '16px', color: '#505a5f', mb: 1 }}>
                  Client: <strong>{project.client.name}</strong>
                </Typography>
              )}
              <Typography variant="body1" paragraph sx={{ fontSize: '18px' }}>
                {project.description}
              </Typography>
              <Typography variant="body2" sx={gdsStyles.caption}>
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Button
              component={RouterLink}
              to={`/upload/clients/${project.clientId}`}
              sx={gdsStyles.secondaryButton}
            >
              Back to Client
            </Button>
            <Button
              component={RouterLink}
              to="/upload/projects"
              sx={{...gdsStyles.secondaryButton, ml: 2}}
            >
              Back to Projects
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Turbosort Directory Section */}
      <Box mt={6}>
        <Paper elevation={0} sx={gdsStyles.card}>
          <Box p={4}>
            <Typography variant="h5" component="h2" sx={gdsStyles.heading}>
              Turbosort Directory
            </Typography>
            
            {turbosortError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setTurbosortError(null)}>
                {turbosortError}
              </Alert>
            )}
            
            {isEditingTurbosort ? (
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <TextField
                  label="Directory Name"
                  value={turbosortDirectory}
                  onChange={(e) => setTurbosortDirectory(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Enter directory name"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      '& fieldset': {
                        borderColor: '#0b0c0c',
                      },
                    },
                  }}
                />
                <Button 
                  sx={gdsStyles.primaryButton}
                  onClick={handleSaveTurbosortDirectory}
                  disabled={!turbosortDirectory.trim()}
                >
                  Save
                </Button>
                <Button 
                  sx={gdsStyles.secondaryButton}
                  onClick={() => {
                    setIsEditingTurbosort(false);
                    // Reset to original value if canceling
                    if (project?.turbosortDirectory) {
                      setTurbosortDirectory(project.turbosortDirectory);
                    } else {
                      setTurbosortDirectory('');
                    }
                  }}
                >
                  Cancel
                </Button>
              </Box>
            ) : (
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {project.turbosortDirectory ? (
                  <>
                    <Typography variant="body1" sx={{ fontSize: '18px' }}>
                      Current directory: <strong>{project.turbosortDirectory}</strong>
                    </Typography>
                    <Tooltip title="Edit Directory">
                      <IconButton 
                        size="small" 
                        onClick={() => setIsEditingTurbosort(true)}
                        sx={{ color: '#1d70b8' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Directory">
                      <IconButton 
                        size="small" 
                        sx={{ color: '#d4351c' }}
                        onClick={handleDeleteTurbosortDirectory}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  <Button 
                    sx={gdsStyles.secondaryButton}
                    onClick={() => setIsEditingTurbosort(true)}
                  >
                    Set Turbosort Directory
                  </Button>
                )}
              </Box>
            )}
            
            <Typography variant="body2" sx={gdsStyles.caption}>
              The turbosort directory is used to specify where files should be sorted in the project.
            </Typography>
          </Box>
        </Paper>
      </Box>

      {/* Upload Links Section */}
      <Box mt={6}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2" sx={gdsStyles.heading}>
            Upload Links
          </Typography>
          <Button
            sx={gdsStyles.primaryButton}
            onClick={() => setShowCreateLink(true)}
          >
            Create Upload Link
          </Button>
        </Box>

        {showCreateLink && (
          <Box mb={4}>
            <Paper elevation={0} sx={gdsStyles.card}>
              <Box p={4}>
                <CreateUploadLinkForm
                  projectId={projectId || ''}
                  onSuccess={handleLinkCreated}
                  onCancel={() => setShowCreateLink(false)}
                />
              </Box>
            </Paper>
          </Box>
        )}

        {project?.uploadLinks && project.uploadLinks.length > 0 ? (
          <TableContainer component={Paper} sx={gdsStyles.tableContainer}>
            <Table sx={gdsStyles.table}>
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col" width="30%">Token</TableCell>
                  <TableCell component="th" scope="col" width="15%">Status</TableCell>
                  <TableCell component="th" scope="col" width="15%">Usage</TableCell>
                  <TableCell component="th" scope="col" width="20%">Expires</TableCell>
                  <TableCell component="th" scope="col" width="20%">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {project.uploadLinks.map((link) => (
                  <TableRow 
                    key={link.id}
                    sx={gdsStyles.tableRow}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mr: 1 }}>
                          {link.token}
                        </Typography>
                        <Tooltip title={copySuccess === link.token ? "Copied!" : "Copy link"}>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              handleCopyLink(link.token);
                            }}
                            className="action-button"
                            sx={{ color: '#1d70b8' }}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {link.isActive === false ? (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            backgroundColor: '#f3f2f1',
                            color: '#d4351c',
                            display: 'inline-block',
                            padding: '3px 8px',
                            fontWeight: 'bold',
                            border: '2px solid #d4351c',
                          }}
                        >
                          Inactive
                        </Typography>
                      ) : new Date(link.expiresAt) < new Date() ? (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            backgroundColor: '#f3f2f1',
                            color: '#f47738',
                            display: 'inline-block',
                            padding: '3px 8px',
                            fontWeight: 'bold',
                            border: '2px solid #f47738',
                          }}
                        >
                          Expired
                        </Typography>
                      ) : (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            backgroundColor: '#f3f2f1',
                            color: '#00703c',
                            display: 'inline-block',
                            padding: '3px 8px',
                            fontWeight: 'bold',
                            border: '2px solid #00703c',
                          }}
                        >
                          Active
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.usedCount} / {link.maxUses === 0 ? '∞' : link.maxUses}
                    </TableCell>
                    <TableCell>
                      {new Date(link.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={2}>
                        <Button
                          variant="text"
                          startIcon={<OpenInNew />}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            openClientUploadPage(link);
                          }}
                          sx={{ 
                            color: '#1d70b8',
                            textDecoration: 'underline',
                            padding: '0',
                            minWidth: 'auto',
                            textTransform: 'none',
                            fontWeight: 'normal',
                            '&:hover': {
                              backgroundColor: 'transparent',
                              textDecoration: 'underline',
                            }
                          }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="text"
                          startIcon={<EditIcon />}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            setLinkToEdit(link);
                            // Format date for the date input (YYYY-MM-DD)
                            const date = new Date(link.expiresAt);
                            const formattedDate = date.toISOString().split('T')[0];
                            setEditExpiresAt(formattedDate);
                            setIsEditingLink(true);
                          }}
                          sx={{ 
                            color: '#1d70b8',
                            textDecoration: 'underline',
                            padding: '0',
                            minWidth: 'auto',
                            textTransform: 'none',
                            fontWeight: 'normal',
                            '&:hover': {
                              backgroundColor: 'transparent',
                              textDecoration: 'underline',
                            }
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="text"
                          startIcon={<DeleteIcon />}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            setLinkToDelete(link);
                            setDeleteDialogOpen(true);
                          }}
                          sx={{ 
                            color: '#d4351c',
                            textDecoration: 'underline',
                            padding: '0',
                            minWidth: 'auto',
                            textTransform: 'none',
                            fontWeight: 'normal',
                            '&:hover': {
                              backgroundColor: 'transparent',
                              textDecoration: 'underline',
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper elevation={0} sx={{...gdsStyles.card, p: 4}}>
            <Typography sx={gdsStyles.caption}>No upload links created yet</Typography>
          </Paper>
        )}
      </Box>

      {/* Uploaded Files Section */}
      <Box mt={6} mb={4}>
        <Typography variant="h5" component="h2" sx={gdsStyles.heading}>
          Uploaded Files
        </Typography>

        {files.length > 0 ? (
          <TableContainer component={Paper} sx={gdsStyles.tableContainer}>
            <Table sx={gdsStyles.table}>
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col" width="30%">Filename</TableCell>
                  <TableCell component="th" scope="col" width="15%">Size</TableCell>
                  <TableCell component="th" scope="col" width="20%">Upload Date</TableCell>
                  <TableCell component="th" scope="col" width="25%">Hash</TableCell>
                  <TableCell component="th" scope="col" width="10%">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => (
                  <TableRow 
                    key={file.id}
                    sx={{
                      ...gdsStyles.tableRow,
                      cursor: 'pointer',
                    }}
                    onClick={(event) => {
                      // Prevent download if clicking on a button or its container
                      if (event.currentTarget.querySelector('.download-button')?.contains(event.target as Node)) {
                        return;
                      }
                      // Download the file
                      handleDownload(file.id, file.filename);
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'medium' }}>{file.filename}</TableCell>
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
                            fontFamily: 'monospace',
                            fontSize: '14px',
                          }}
                        >
                          {file.hash}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="text"
                        startIcon={<DownloadIcon />}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click
                          handleDownload(file.id, file.filename);
                        }}
                        className="download-button"
                        sx={{ 
                          color: '#1d70b8',
                          textDecoration: 'underline',
                          padding: '0',
                          minWidth: 'auto',
                          textTransform: 'none',
                          fontWeight: 'normal',
                          '&:hover': {
                            backgroundColor: 'transparent',
                            textDecoration: 'underline',
                          }
                        }}
                      >
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Paper elevation={0} sx={{...gdsStyles.card, p: 4}}>
            <Typography sx={gdsStyles.caption}>No files uploaded yet</Typography>
          </Paper>
        )}
      </Box>

      {/* Edit Project Dialog */}
      <Dialog 
        open={isEditingProject} 
        onClose={() => setIsEditingProject(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            maxWidth: '500px',
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#f3f2f1', fontWeight: 'bold' }}>
          Edit Project
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {editError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setEditError(null)}>
              {editError}
            </Alert>
          )}
          <TextField
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
            placeholder="Enter project name"
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                '& fieldset': {
                  borderColor: '#0b0c0c',
                },
              },
            }}
          />
          <TextField
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={3}
            variant="outlined"
            placeholder="Enter project description"
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                '& fieldset': {
                  borderColor: '#0b0c0c',
                },
              },
            }}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setIsEditingProject(false)}
            sx={gdsStyles.secondaryButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateProject} 
            disabled={!editName.trim() || (editName === project?.name && editDescription === project?.description)}
            sx={gdsStyles.primaryButton}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Upload Link Dialog */}
      <Dialog 
        open={isEditingLink} 
        onClose={() => setIsEditingLink(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            maxWidth: '500px',
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#f3f2f1', fontWeight: 'bold' }}>
          Edit Upload Link
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {editLinkError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setEditLinkError(null)}>
              {editLinkError}
            </Alert>
          )}
          {linkToEdit && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Token:</strong> {linkToEdit.token}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Status:</strong> {linkToEdit.isActive === false ? 'Inactive' : 'Active'}
                </Typography>
                <Typography variant="body1">
                  <strong>Usage:</strong> {linkToEdit.usedCount} / {linkToEdit.maxUses === 0 ? '∞' : linkToEdit.maxUses}
                </Typography>
              </Box>
              
              <TextField
                label="Expiration Date"
                type="date"
                value={editExpiresAt}
                onChange={(e) => setEditExpiresAt(e.target.value)}
                fullWidth
                margin="normal"
                variant="outlined"
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ 
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 0,
                    '& fieldset': {
                      borderColor: '#0b0c0c',
                    },
                  },
                }}
              />
            </>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setIsEditingLink(false)}
            sx={gdsStyles.secondaryButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateUploadLink} 
            disabled={!editExpiresAt}
            sx={gdsStyles.primaryButton}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            maxWidth: '500px',
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#f3f2f1', fontWeight: 'bold' }}>
          Delete Upload Link
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ mb: 3 }}>
            Are you sure you want to delete this upload link?
          </Typography>
          {linkToDelete && (
            <Box sx={{ backgroundColor: '#f8f8f8', p: 2, mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Token:</strong> {linkToDelete.token}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Status:</strong> {linkToDelete.isActive === false ? 'Inactive' : 'Active'}
              </Typography>
              <Typography variant="body2">
                <strong>Usage:</strong> {linkToDelete.usedCount} / {linkToDelete.maxUses === 0 ? '∞' : linkToDelete.maxUses}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="error">
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={gdsStyles.secondaryButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteUploadLink} 
            sx={{
              backgroundColor: '#d4351c',
              color: 'white',
              borderRadius: '0',
              fontWeight: 'bold',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: '#aa2a16',
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectDetails; 