import React, { useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import { stopOBSStream } from '../../utils/api';
import { Button } from '../GovUkComponents';

interface OBSControlsProps {
  showLabel?: boolean;
}

const OBSControls: React.FC<OBSControlsProps> = ({ showLabel = true }) => {
  const [stoppingStream, setStoppingStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleStopStream = async () => {
    setStoppingStream(true);
    setError(null);
    setSuccess(null);
    try {
      await stopOBSStream();
      setSuccess('OBS stream stopped successfully');
    } catch (error: any) {
      console.error('Failed to stop OBS stream:', error);
      setError(error.response?.data?.message || 'Failed to stop OBS stream. Make sure OBS is connected.');
    } finally {
      setStoppingStream(false);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Button
        variant="red"
        onClick={handleStopStream}
        disabled={stoppingStream}
      >
        {stoppingStream ? <CircularProgress size={24} color="inherit" /> : showLabel ? 'STOP OBS STREAM' : 'STOP STREAM'}
      </Button>
    </Box>
  );
};

export default OBSControls; 