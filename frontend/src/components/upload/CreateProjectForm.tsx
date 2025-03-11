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
import { CreateProjectRequest } from '../../types/upload';

interface CreateProjectFormProps {
  clientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  clientId,
  onSuccess,
  onCancel,
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
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const projectData: CreateProjectRequest = {
        ...formData,
        description: description.trim() || undefined
      };

      const response = await createProject(clientId, projectData);
      
      if (response.status === 'success') {
        onSuccess?.();
      } else {
        setError(response.message || 'Failed to create project');
      }
    } catch (err: any) {
      console.error('Project creation error:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2}>
      <Box p={3} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          Create New Project
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Project Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          margin="normal"
          required
          error={!!error && !formData.name}
          helperText={!!error && !formData.name ? 'Project name is required' : ''}
        />

        <TextField
          fullWidth
          label="Description (Optional)"
          name="description"
          value={description}
          onChange={handleChange}
          margin="normal"
          multiline
          rows={3}
        />

        <Stack direction="row" spacing={2} mt={2}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Project'}
          </Button>
          <Button variant="outlined" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default CreateProjectForm; 