import React, { useState, useEffect } from 'react';
import { Project } from '../../types/upload';
import { getAllProjects } from '../../services/uploadService';
import { Box, TextField, Typography, Card, CardContent, Grid, CircularProgress, Chip } from '@mui/material';
import { Link } from 'react-router-dom';

interface ProjectListProps {
  refreshTrigger?: number;
}

const ProjectList: React.FC<ProjectListProps> = ({ refreshTrigger = 0 }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await getAllProjects();
        if (response.status === 'success') {
          setProjects(response.data);
          setFilteredProjects(response.data);
        } else {
          setError(response.message || 'Failed to fetch projects');
        }
      } catch (err) {
        setError('Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [refreshTrigger]);

  useEffect(() => {
    const filtered = projects.filter(
      (project) =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProjects(filtered);
  }, [searchTerm, projects]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom>
          All Projects
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search projects by name, description or client..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
        />
      </Box>

      <Grid container spacing={2}>
        {filteredProjects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {project.name}
                </Typography>
                <Chip 
                  label={project.client?.name} 
                  size="small" 
                  variant="outlined" 
                  sx={{ mb: 1 }} 
                />
                <Typography variant="body2" color="textSecondary" gutterBottom sx={{ mt: 1 }}>
                  {project.description || 'No description'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </Typography>
                <Box mt={2}>
                  <Link
                    to={`/upload/projects/${project.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography color="primary">View Details →</Typography>
                  </Link>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredProjects.length === 0 && (
        <Box mt={3} textAlign="center">
          <Typography color="textSecondary">No projects found</Typography>
        </Box>
      )}
    </Box>
  );
};

export default ProjectList; 