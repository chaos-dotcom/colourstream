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
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { createUploadLink } from '../../services/uploadService';
import { CreateUploadLinkRequest } from '../../types/upload';

interface CreateUploadLinkFormProps {
  projectId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreateUploadLinkForm: React.FC<CreateUploadLinkFormProps> = ({
  projectId,
  onSuccess,
  onCancel,
}) => {
  const [expiresAt, setExpiresAt] = useState<Date | null>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default to 7 days from now
  );
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!expiresAt) {
      setError('Expiry date is required');
      return false;
    }
    if (expiresAt <= new Date()) {
      setError('Expiry date must be in the future');
      return false;
    }
    if (usageLimit && (isNaN(Number(usageLimit)) || Number(usageLimit) <= 0)) {
      setError('Usage limit must be a positive number');
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

    const formData: CreateUploadLinkRequest = {
      projectId,
      expiresAt: expiresAt!.toISOString(),
      usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
    };

    setLoading(true);
    try {
      const response = await createUploadLink(projectId, formData);
      if (response.status === 'success') {
        onSuccess?.();
      } else {
        setError(response.message || 'Failed to create upload link');
      }
    } catch (err) {
      setError('Failed to create upload link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={2}>
      <Box p={3} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          Create Upload Link
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label="Expires At"
            value={expiresAt}
            onChange={(newValue: Date | null) => setExpiresAt(newValue)}
            slotProps={{
              textField: {
                fullWidth: true,
                margin: 'normal',
                required: true,
                error: !!error && !expiresAt,
              },
            }}
          />
        </LocalizationProvider>

        <TextField
          fullWidth
          label="Usage Limit (Optional)"
          type="number"
          value={usageLimit}
          onChange={(e) => setUsageLimit(e.target.value)}
          margin="normal"
          helperText="Leave empty for unlimited uses"
          inputProps={{ min: 1 }}
        />

        <Stack direction="row" spacing={2} mt={2}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Link'}
          </Button>
          <Button variant="outlined" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default CreateUploadLinkForm; 