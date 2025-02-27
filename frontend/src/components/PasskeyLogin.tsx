import React, { useState } from 'react';
import {
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';
import { authenticateWithPasskey } from '../utils/api';
import { useNavigate } from 'react-router-dom';

interface PasskeyLoginProps {
  onError?: (error: any) => void;
}

const PasskeyLogin: React.FC<PasskeyLoginProps> = ({ onError }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);

    try {
      await authenticateWithPasskey();
      navigate('/admin/dashboard');
    } catch (error: any) {
      // Propagate error to parent component if callback provided
      if (onError) {
        onError(error);
      } else {
        console.error('Passkey authentication error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex">
      <Button
        variant="contained"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <KeyIcon />}
        onClick={handleLogin}
        disabled={loading}
        size="large"
      >
        Sign in with Passkey
      </Button>
    </Box>
  );
};

export default PasskeyLogin; 