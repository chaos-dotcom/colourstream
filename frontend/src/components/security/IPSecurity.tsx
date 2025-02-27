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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Alert,
  Snackbar,
  TablePagination
} from '@mui/material';
import { api } from '../../utils/api';

interface BlockedIP {
  id: string;
  hashedIP: string;
  originalIP: string;
  reason: string;
  blockedAt: string;
  unblockAt: string | null;
  failedAttempts: number;
  isActive: boolean;
}

const IPSecurity: React.FC = () => {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState({
    ip: '',
    reason: '',
    duration: 0 // 0 means permanent
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchBlockedIPs();
  }, [page, rowsPerPage]);

  const fetchBlockedIPs = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/security/blocked-ips?page=${page + 1}&limit=${rowsPerPage}`);
      setBlockedIPs(response.data.data.blockedIPs);
      setTotal(response.data.data.pagination.total);
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
      setError('Failed to fetch blocked IPs');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    if (!newBlock.ip) {
      setError('IP address is required');
      return;
    }

    if (!newBlock.reason) {
      setError('Reason is required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/security/block-ip', {
        ip: newBlock.ip,
        reason: newBlock.reason,
        duration: newBlock.duration
      });
      setSuccess('IP blocked successfully');
      setBlockDialogOpen(false);
      setNewBlock({
        ip: '',
        reason: '',
        duration: 0
      });
      fetchBlockedIPs();
    } catch (error) {
      console.error('Error blocking IP:', error);
      setError('Failed to block IP');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    if (!window.confirm('Are you sure you want to unblock this IP?')) {
      return;
    }

    setLoading(true);
    try {
      await api.post('/security/unblock-ip', { ip });
      setSuccess('IP unblocked successfully');
      fetchBlockedIPs();
    } catch (error) {
      console.error('Error unblocking IP:', error);
      setError('Failed to unblock IP');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDialogClose = () => {
    setBlockDialogOpen(false);
    setNewBlock({
      ip: '',
      reason: '',
      duration: 0
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setBlockDialogOpen(true)}
        >
          Block IP
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableCell>IP Address</TableCell>
            <TableCell>Reason</TableCell>
            <TableCell>Blocked At</TableCell>
            <TableCell>Unblock At</TableCell>
            <TableCell>Failed Attempts</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {blockedIPs.map((ip) => (
            <TableRow key={ip.id}>
              <TableCell>{ip.originalIP || ip.hashedIP}</TableCell>
              <TableCell>{ip.reason}</TableCell>
              <TableCell>{new Date(ip.blockedAt).toLocaleString()}</TableCell>
              <TableCell>
                {ip.unblockAt ? new Date(ip.unblockAt).toLocaleString() : 'Never'}
              </TableCell>
              <TableCell>{ip.failedAttempts}</TableCell>
              <TableCell>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => handleUnblockIP(ip.originalIP || ip.hashedIP)}
                  disabled={loading}
                >
                  Unblock
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />

      <Dialog open={blockDialogOpen} onClose={handleDialogClose}>
        <DialogTitle>Block IP Address</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="IP Address"
            fullWidth
            variant="outlined"
            value={newBlock.ip}
            onChange={(e) => setNewBlock({ ...newBlock, ip: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Reason"
            fullWidth
            variant="outlined"
            value={newBlock.reason}
            onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Duration (hours, 0 for permanent)"
            type="number"
            fullWidth
            variant="outlined"
            value={newBlock.duration}
            onChange={(e) => setNewBlock({ ...newBlock, duration: parseInt(e.target.value) || 0 })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleBlockIP} variant="contained" color="primary" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Block'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default IPSecurity; 