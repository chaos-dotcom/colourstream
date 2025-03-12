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
} from '@mui/material';
import { Client, Project } from '../../types/upload';
import { getClients, getClientProjects, deleteProject, deleteClient } from '../../services/uploadService';
import CreateProjectForm from './CreateProjectForm';

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

  const handleProjectDelete = async (projectId: string) => {
    try {
      const response = await deleteProject(projectId);
      if (response.status === 'success') {
        // Refresh the projects list
        const projectsResponse = await getClientProjects(clientId!);
        if (projectsResponse.status === 'success') {
          setProjects(projectsResponse.data);
        }
      }
    } catch (err) {
      setError('Failed to delete project');
    }
  };

  const handleDeleteClient = async () => {
    if (!clientId) return;
    
    try {
      const response = await deleteClient(clientId);
      
      if (response.status === 'success') {
        // Navigate back to clients list on successful deletion
        setSuccessMessage('Client deleted successfully');
        setTimeout(() => {
          navigate('/admin/upload');
        }, 1500);
      } else {
        setError(response.message || 'Failed to delete client');
        setDeleteDialogOpen(false);
      }
    } catch (err) {
      setError('Failed to delete client');
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await deleteProject(projectId);
      
      if (response.status === 'success') {
        // Remove project from state
        setProjects(projects.filter(project => project.id !== projectId));
        setSuccessMessage('Project deleted successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.message || 'Failed to delete project');
      }
    } catch (err) {
      setError('Failed to delete project');
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
    <Box p={2}>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">{client.name}</Typography>
          <Button 
            variant="contained" 
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Client
          </Button>
        </Box>
        <Typography color="textSecondary">Client Code: {client.code || 'Auto-generated'}</Typography>
        <Typography color="textSecondary">
          Created: {new Date(client.createdAt).toLocaleDateString()}
        </Typography>
      </Paper>

      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Projects</Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => setShowCreateProject(true)}
          >
            Create Project
          </Button>
        </Box>

        <Grid container spacing={2}>
          {projects.length > 0 ? (
            projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="h6">{project.name}</Typography>
                      <Button 
                        size="small" 
                        color="error"
                        onClick={() => handleDeleteProject(project.id)}
                      >
                        Delete
                      </Button>
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {project.description || 'No description provided'}
                    </Typography>
                    <Box mt={2}>
                      <Button
                        component={RouterLink}
                        to={`/upload/projects/${project.id}`}
                        color="primary"
                        size="small"
                      >
                        View Details
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography color="textSecondary">No projects found for this client</Typography>
            </Grid>
          )}
        </Grid>
      </Box>

      {showCreateProject && (
        <CreateProjectForm
          clientId={clientId!}
          onClose={() => setShowCreateProject(false)}
          onSuccess={(newProject: Project) => {
            setProjects([...projects, newProject]);
            setShowCreateProject(false);
          }}
        />
      )}

      {/* Delete Client Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete client "{client.name}"?
            This will also delete all projects and upload links associated with this client.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteClient} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientDetails; 