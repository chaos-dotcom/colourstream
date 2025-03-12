import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { createProject } from '../../services/uploadService';
import { CreateProjectRequest, Project } from '../../types/upload';

interface CreateProjectFormProps {
  clientId: string;
  onSuccess?: (project: Project) => void;
  onClose?: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  clientId,
  onSuccess,
  onClose,
}) => {
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    clientId,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'description') {
      setDescription(value);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Project name is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const projectData = {
      ...formData,
      description: description || undefined,
    };

    setLoading(true);
    try {
      const response = await createProject(clientId, projectData);
      if (response.status === 'success') {
        if (onSuccess) onSuccess(response.data);
      } else {
        setError(response.message || 'Failed to create project');
      }
    } catch (err) {
      setError('An error occurred while creating the project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Create New Project
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <form onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Project Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
          
          <TextField
            fullWidth
            label="Description (Optional)"
            name="description"
            value={description}
            onChange={handleChange}
            multiline
            rows={3}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            {onClose && (
              <Button onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Create Project'}
            </Button>
          </Box>
        </Stack>
      </form>
    </Paper>
  );
};

export default CreateProjectForm; 