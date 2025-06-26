import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface UploadLink {
  id: string;
  token: string;
  expiresAt: string;
  maxUses: number | null;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string;
    }
  };
}

interface UploadLinkEditDialogProps {
  open: boolean;
  onClose: () => void;
  uploadLink: UploadLink;
  onSave: (linkId: string, data: { expiresAt?: string; maxUses?: number | null }) => Promise<void>;
}

const UploadLinkEditDialog: React.FC<UploadLinkEditDialogProps> = ({
  open,
  onClose,
  uploadLink,
  onSave,
}) => {
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(uploadLink.expiresAt));
  const [usageLimit, setUsageLimit] = useState<number | null>(uploadLink.maxUses);
  const [unlimitedUses, setUnlimitedUses] = useState<boolean>(uploadLink.maxUses === null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlimitedUsesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setUnlimitedUses(checked);
    setUsageLimit(checked ? null : (uploadLink.maxUses || 1));
  };

  const handleUsageLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setUsageLimit(isNaN(value) ? 1 : Math.max(1, value));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await onSave(uploadLink.id, {
        expiresAt: expiresAt.toISOString(),
        maxUses: unlimitedUses ? null : usageLimit
      });
    } catch (err) {
      setError('Failed to update upload link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Upload Link</DialogTitle>
      <DialogContent>
        <Box mb={2} mt={1}>
          <Typography variant="subtitle1" gutterBottom>
            <strong>Project:</strong> {uploadLink.project.name}
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            <strong>Client:</strong> {uploadLink.project.client.name}
          </Typography>
          <Typography variant="subtitle1" gutterBottom>
            <strong>Token:</strong> {uploadLink.token}
          </Typography>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label="Expiration Date"
            value={expiresAt}
            onChange={(newValue) => newValue && setExpiresAt(newValue)}
            slotProps={{ 
              textField: { 
                fullWidth: true, 
                margin: 'normal' 
              } 
            }}
          />
        </LocalizationProvider>

        <FormControlLabel
          control={
            <Checkbox 
              checked={unlimitedUses} 
              onChange={handleUnlimitedUsesChange}
            />
          }
          label="Unlimited uses"
          sx={{ mt: 2, mb: 1 }}
        />

        {!unlimitedUses && (
          <TextField
            label="Usage Limit"
            type="number"
            fullWidth
            value={usageLimit || 1}
            onChange={handleUsageLimitChange}
            inputProps={{ min: 1 }}
            margin="normal"
          />
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          color="primary" 
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadLinkEditDialog; 