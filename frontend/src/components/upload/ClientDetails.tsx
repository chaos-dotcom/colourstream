import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
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
} from '@mui/material';
import { Client, Project } from '../../types/upload';
import { getClients, getClientProjects } from '../../services/uploadService';
import CreateProjectForm from './CreateProjectForm';

const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);

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
      <Paper elevation={2}>
        <Box p={3}>
          <Typography variant="h5" gutterBottom>
            {client.name}
          </Typography>
          <Typography color="textSecondary" gutterBottom>
            Code: {client.code}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Created: {new Date(client.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
      </Paper>

      <Box mt={4}>
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

        {showCreateProject && (
          <Box mb={3}>
            <CreateProjectForm
              clientId={clientId!}
              onSuccess={handleProjectCreated}
              onCancel={() => setShowCreateProject(false)}
            />
          </Box>
        )}

        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {project.description}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                  <Box mt={2}>
                    <Button
                      component={RouterLink}
                      to={`/projects/${project.id}`}
                      color="primary"
                    >
                      View Details
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {projects.length === 0 && !showCreateProject && (
          <Box mt={3} textAlign="center">
            <Typography color="textSecondary">No projects found</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ClientDetails; 