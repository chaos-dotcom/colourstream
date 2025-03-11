import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { createClient } from '../../services/uploadService';
import { CreateClientRequest } from '../../types/upload';

interface CreateClientFormProps {
  onSuccess?: () => void;
}

const CreateClientForm: React.FC<CreateClientFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<CreateClientRequest>({
    name: '',
    code: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Client name is required');
      return false;
    }
    if (formData.code && !/^[A-Z0-9]+$/.test(formData.code)) {
      setError('Client code must contain only uppercase letters and numbers');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // If code is empty or whitespace, send undefined so server will auto-generate it
      const code = formData.code?.trim();
      const response = await createClient({
        name: formData.name,
        code: code === '' ? undefined : code
      });
      if (response.status === 'success') {
        setSuccess(true);
        setFormData({ name: '', code: '' });
        onSuccess?.();
      } else {
        setError(response.message || 'Failed to create client');
      }
    } catch (err) {
      setError('Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2}>
      <Box p={3} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          Create New Client
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Client created successfully!
          </Alert>
        )}

        <TextField
          fullWidth
          label="Client Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          margin="normal"
          required
          error={!!error && !formData.name}
        />

        <TextField
          fullWidth
          label="Client Code (Optional)"
          name="code"
          value={formData.code}
          onChange={handleChange}
          margin="normal"
          error={Boolean(error && formData.code && !/^[A-Z0-9]+$/.test(formData.code))}
          helperText="Optional. Uppercase letters and numbers only. Will be auto-generated if left empty."
          inputProps={{ style: { textTransform: 'uppercase' } }}
        />

        <Box mt={2}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Client'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default CreateClientForm; 