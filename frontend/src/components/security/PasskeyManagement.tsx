import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
  Typography,
  Paper
} from '@mui/material';
import { getPasskeys, registerPasskey, removePasskey } from '../../utils/api';

interface Passkey {
  id: string;
  credentialId: string;
  lastUsed: string;
}

const PasskeyManagement: React.FC = () => {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPasskeys();
  }, []);

  const fetchPasskeys = async () => {
    setLoading(true);
    try {
      const response = await getPasskeys();
      setPasskeys(response);
    } catch (error) {
      console.error('Error fetching passkeys:', error);
      setError('Failed to fetch passkeys');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setRegistering(true);
    setError(null);
    try {
      // Start registration
      await registerPasskey();
      setSuccess('Passkey registered successfully');
      fetchPasskeys();
    } catch (error: any) {
      console.error('Error registering passkey:', error);
      setError('Failed to register passkey. Make sure your device supports WebAuthn.');
    } finally {
      setRegistering(false);
    }
  };

  const handleRemovePasskey = async (credentialId: string) => {
    if (!window.confirm('Are you sure you want to remove this passkey?')) {
      return;
    }

    setLoading(true);
    try {
      await removePasskey(credentialId);
      setSuccess('Passkey removed successfully');
      fetchPasskeys();
    } catch (error) {
      console.error('Error removing passkey:', error);
      setError('Failed to remove passkey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="body1">
          Passkeys provide a more secure way to authenticate without passwords. They use biometric authentication (fingerprint, face recognition) or device PIN.
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleRegisterPasskey}
          disabled={registering || loading}
        >
          {registering ? <CircularProgress size={24} /> : 'Register New Passkey'}
        </Button>
      </Box>

      {loading && !registering && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {passkeys.length > 0 ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Passkey</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {passkeys.map((passkey, index) => (
              <TableRow key={passkey.id}>
                <TableCell>Passkey {index + 1}</TableCell>
                <TableCell>{new Date(passkey.lastUsed).toLocaleString()}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => handleRemovePasskey(passkey.credentialId)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No passkeys registered. Register a passkey to enhance security.
        </Alert>
      )}

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)}>
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PasskeyManagement; 