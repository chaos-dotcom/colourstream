import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  TablePagination,
  Tooltip,
} from '@mui/material';
import { Delete as DeleteIcon, Block as BlockIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '../../utils/api';

interface BlockedIP {
  id: string;
  hashedIP: string;
  ip: string;
  reason: string;
  blockedAt: string;
  unblockAt: string | null;
  failedAttempts: number;
  isActive: boolean;
}

interface BlockIPDialogProps {
  open: boolean;
  onClose: () => void;
  onBlock: (ip: string, reason: string, duration?: number) => void;
}

const BlockIPDialog: React.FC<BlockIPDialogProps> = ({ open, onClose, onBlock }) => {
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');

  const handleSubmit = () => {
    onBlock(ip, reason, duration ? parseInt(duration) * 60 * 60 * 1000 : undefined);
    setIp('');
    setReason('');
    setDuration('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Block IP Address</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="IP Address"
          fullWidth
          value={ip}
          onChange={(e) => setIp(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Reason"
          fullWidth
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Duration (hours, optional)"
          type="number"
          fullWidth
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          helperText="Leave empty for permanent block"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={!ip || !reason}>Block</Button>
      </DialogActions>
    </Dialog>
  );
};

export const SecuritySettings: React.FC = () => {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const fetchBlockedIPs = async () => {
    try {
      const response = await api.get(`/security/blocked-ips?page=${page + 1}&limit=${rowsPerPage}`);
      setBlockedIPs(response.data.data.blockedIPs);
      setTotal(response.data.data.pagination.total);
    } catch (error) {
      enqueueSnackbar('Failed to fetch blocked IPs', { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchBlockedIPs();
  }, [page, rowsPerPage]);

  const handleBlockIP = async (ip: string, reason: string, duration?: number) => {
    try {
      await api.post('/security/block-ip', { ip, reason, duration });
      enqueueSnackbar('IP blocked successfully', { variant: 'success' });
      fetchBlockedIPs();
    } catch (error) {
      enqueueSnackbar('Failed to block IP', { variant: 'error' });
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      await api.post('/security/unblock-ip', { ip });
      enqueueSnackbar('IP unblocked successfully', { variant: 'success' });
      fetchBlockedIPs();
    } catch (error) {
      enqueueSnackbar('Failed to unblock IP', { variant: 'error' });
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">IP Security</Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<BlockIcon />}
            onClick={() => setBlockDialogOpen(true)}
          >
            Block IP
          </Button>
        </Box>

        <TableContainer component={Paper}>
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
                  <TableCell>{ip.ip || ip.hashedIP}</TableCell>
                  <TableCell>{ip.reason}</TableCell>
                  <TableCell>{new Date(ip.blockedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {ip.unblockAt ? new Date(ip.unblockAt).toLocaleString() : 'Never'}
                  </TableCell>
                  <TableCell>{ip.failedAttempts}</TableCell>
                  <TableCell>
                    <Tooltip title="Unblock IP">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleUnblockIP(ip.ip || ip.hashedIP)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
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
          />
        </TableContainer>

        <BlockIPDialog
          open={blockDialogOpen}
          onClose={() => setBlockDialogOpen(false)}
          onBlock={handleBlockIP}
        />
      </CardContent>
    </Card>
  );
}; 