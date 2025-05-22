import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  TextField,
} from '@mui/material';
import { Client, Project } from '../../types/upload';
import { getClients, getClientProjects, deleteProject, deleteClient, updateClient } from '../../services/uploadService';
import CreateProjectForm from './CreateProjectForm';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNew from '@mui/icons-material/OpenInNew';

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
  dangerButton: {
    backgroundColor: '#d4351c',
    color: 'white',
    borderRadius: '0',
    fontWeight: 'bold',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: '#aa2a16',
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
};

const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // New state variables for client name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const [clientResponse, projectsResponse] = await Promise.all([
          getClients(),
          getClientProjects(clientId!),
        ]);

        if (clientResponse.status === 'success') {
          const foundClient = clientResponse.data.find((c) => c.id === clientId);
          if (foundClient) {
            setClient(foundClient);
          } else {
            setError('Client not found');
          }
        }

        if (projectsResponse.status === 'success') {
          setProjects(projectsResponse.data);
        }
      } catch (err) {
        setError('Failed to fetch client data');
      } finally {
        setLoading(false);
      }
    };

    if (clientId) {
      fetchClientData();
    }
  }, [clientId]);

  const handleProjectCreated = async () => {
    setShowCreateProject(false);
    try {
      const response = await getClientProjects(clientId!);
      if (response.status === 'success') {
        setProjects(response.data);
      }
    } catch (err) {
      setError('Failed to refresh projects');
    }
  };

  // This function is not being used, removing it

  const handleDeleteClient = async () => {
    if (!clientId) return;
    
    try {
      console.log('Attempting to delete client:', clientId);
      const response = await deleteClient(clientId);
      console.log('Delete client response:', response);
      
      if (response.status === 'success') {
        // Navigate back to clients list on successful deletion
        setSuccessMessage('Client deleted successfully');
        setTimeout(() => {
          navigate('/admin/upload');
        }, 1500);
      } else {
        let errorMessage = response.message || 'Failed to delete client';
        
        // Check for specific error messages
        if (response.message && response.message.includes('Foreign key constraint violated')) {
          errorMessage = 'Cannot delete client because it has projects with uploaded files. Please delete all projects and their files first.';
        }
        
        setError(errorMessage);
        setDeleteDialogOpen(false);
      }
    } catch (err: any) {
      console.error('Error deleting client:', err);
      
      let errorMessage = 'Failed to delete client';
      
      // Check for server error (500)
      if (err.response && err.response.status === 500) {
        errorMessage = 'Cannot delete client because it has projects with uploaded files. Please delete all projects and their files first.';
      }
      
      setError(errorMessage);
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      console.log('Attempting to delete project:', projectId);
      const response = await deleteProject(projectId);
      console.log('Delete project response:', response);
      
      if (response.status === 'success') {
        // Remove project from state
        setProjects(projects.filter(project => project.id !== projectId));
        setSuccessMessage('Project deleted successfully. Any uploaded files remain intact.');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        console.error('Failed to delete project:', response.message);
        let errorMessage = response.message || 'Failed to delete project';
        
        // Check for foreign key constraint error
        if ((response as any).code === 'P2003' || 
            (response.message && response.message.includes('Foreign key constraint violated'))) {
          errorMessage = 'Cannot delete project because it has uploaded files in the database. Please contact an administrator to resolve this issue.';
        }
        
        setError(errorMessage);
        setTimeout(() => setError(null), 8000);
      }
    } catch (err: any) {
      console.error('Error deleting project:', err);
      let errorMessage = 'Failed to delete project';
      
      // Check for Prisma error in the caught exception
      if ((err as any).code === 'P2003' || 
          (err.message && err.message.includes('Foreign key constraint violated'))) {
        errorMessage = 'Cannot delete project because it has uploaded files in the database. Please contact an administrator to resolve this issue.';
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
    }
  };

  // Add handleUpdateClient function
  const handleUpdateClient = async () => {
    if (!clientId || !editName.trim()) return;
    
    try {
      setNameError(null);
      const response = await updateClient(clientId, editName.trim());
      
      if (response.status === 'success') {
        setClient(response.data);
        setSuccessMessage('Client name updated successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
        setIsEditingName(false);
      } else {
        setNameError(response.message || 'Failed to update client name');
      }
    } catch (err) {
      setNameError('Failed to update client name');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !client) {
    return (
      <Box p={2}>
        <Typography color="error">{error || 'Client not found'}</Typography>
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
      
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Client Details Card */}
      <Paper elevation={0} sx={gdsStyles.card}>
        <Box p={4}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
            <Box>
              <Box display="flex" alignItems="baseline" sx={{ mb: 2 }}>
                <Typography variant="h4" component="h1" sx={{ ...gdsStyles.heading, mb: 0, mr: 1 }}>
                  {client.name}
                </Typography>
                <Tooltip title="Edit Client Name">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      setEditName(client.name);
                      setIsEditingName(true);
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
              <Typography variant="body1" sx={{ fontSize: '18px', mb: 2 }}>
                Client Code: <strong>{client.code || 'Auto-generated'}</strong>
              </Typography>
              <Typography variant="body2" sx={gdsStyles.caption}>
                Created: {new Date(client.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            <Button 
              sx={gdsStyles.dangerButton}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete Client
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Projects Section */}
      <Box mt={6}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2" sx={gdsStyles.heading}>
            Projects
          </Typography>
          <Button 
            sx={gdsStyles.primaryButton}
            onClick={() => setShowCreateProject(true)}
          >
            Create Project
          </Button>
        </Box>

        {projects.length > 0 ? (
          <TableContainer component={Paper} sx={gdsStyles.tableContainer}>
            <Table sx={gdsStyles.table}>
              <TableHead>
                <TableRow>
                  <TableCell component="th" scope="col" width="25%">Project Name</TableCell>
                  <TableCell component="th" scope="col" width="40%">Description</TableCell>
                  <TableCell component="th" scope="col" width="20%">Created</TableCell>
                  <TableCell component="th" scope="col" width="15%">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((project) => (
                  <TableRow 
                    key={project.id}
                    sx={{
                      ...gdsStyles.tableRow,
                      cursor: 'pointer',
                    }}
                    onClick={(event) => {
                      // Prevent navigation if clicking on the delete button or its container
                      if (event.currentTarget.querySelector('.delete-button')?.contains(event.target as Node)) {
                        return;
                      }
                      // Navigate to the project details page
                      navigate(`/upload/projects/${project.id}`);
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'medium' }}>{project.name}</TableCell>
                    <TableCell>{project.description || 'No description provided'}</TableCell>
                    <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Box display="flex" gap={2}>
                        <Button
                          variant="text"
                          startIcon={<OpenInNew />}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click from triggering
                            navigate(`/upload/projects/${project.id}`);
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
                          View
                        </Button>
                        <Button
                          variant="text"
                          startIcon={<DeleteIcon />}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click from triggering
                            // Show confirmation dialog before deleting
                            if (window.confirm('Are you sure you want to delete this project? The project metadata will be removed, but any uploaded files will remain intact.\n\nNote: If there are files in the database associated with this project, the deletion may fail.')) {
                              handleDeleteProject(project.id);
                            }
                          }}
                          className="delete-button"
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
            <Typography sx={gdsStyles.caption}>No projects found for this client</Typography>
          </Paper>
        )}
      </Box>

      {/* Create Project Form */}
      {showCreateProject && (
        <Box mt={4}>
          <Paper elevation={0} sx={gdsStyles.card}>
            <Box p={4}>
              <Typography variant="h5" component="h2" sx={{...gdsStyles.heading, mb: 3}}>
                Create New Project
              </Typography>
              <CreateProjectForm
                clientId={clientId!}
                onClose={() => setShowCreateProject(false)}
                onSuccess={(newProject: Project) => {
                  setProjects([...projects, newProject]);
                  setShowCreateProject(false);
                }}
              />
            </Box>
          </Paper>
        </Box>
      )}

      {/* Add Edit Client Name Dialog */}
      <Dialog 
        open={isEditingName} 
        onClose={() => setIsEditingName(false)}
        PaperProps={{
          sx: {
            borderRadius: 0,
            maxWidth: '500px',
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: '#f3f2f1', fontWeight: 'bold' }}>
          Edit Client Name
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {nameError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 0 }} onClose={() => setNameError(null)}>
              {nameError}
            </Alert>
          )}
          <TextField
            label="Client Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            margin="normal"
            variant="outlined"
            placeholder="Enter client name"
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
            onClick={() => setIsEditingName(false)}
            sx={gdsStyles.secondaryButton}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateClient} 
            disabled={!editName.trim() || editName === client?.name}
            sx={gdsStyles.primaryButton}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Client Dialog */}
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
          Delete Client
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ mb: 3 }}>
            Are you sure you want to delete client "{client.name}"?
          </Typography>
          <Box sx={{ backgroundColor: '#f8f8f8', p: 2, mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              This will also delete all projects and upload links associated with this client.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Note:</strong> You must first delete all projects that have uploaded files before you can delete this client.
            </Typography>
          </Box>
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
            onClick={handleDeleteClient} 
            sx={gdsStyles.dangerButton}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetails; 
