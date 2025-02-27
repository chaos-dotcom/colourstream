import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  TablePagination,
} from '@mui/material';
import { Delete as DeleteIcon, Block as BlockIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { api } from '../../utils/api';
import { 
  Button as GovUkButton, 
  SectionHeading,
  Table as GovUkTable,
  TableHead as GovUkTableHead,
  TableBody as GovUkTableBody,
  TableRow as GovUkTableRow,
  TableCell as GovUkTableCell
} from '../GovUkComponents';

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
        <GovUkButton variant="secondary" onClick={onClose}>Cancel</GovUkButton>
        <GovUkButton variant="blue" onClick={handleSubmit} disabled={!ip || !reason}>Block</GovUkButton>
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
    <Box sx={{ 
      border: '1px solid #b1b4b6', 
      mb: 3 
    }}>
      <Box sx={{ 
        p: 2, 
        backgroundColor: '#f3f2f1', 
        borderBottom: '1px solid #b1b4b6' 
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <SectionHeading>IP Security</SectionHeading>
          <GovUkButton
            variant="blue"
            onClick={() => setBlockDialogOpen(true)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BlockIcon fontSize="small" />
              Block IP
            </Box>
          </GovUkButton>
        </Box>
      </Box>

      <Box sx={{ p: 2 }}>
        <GovUkTable>
          <GovUkTableHead>
            <GovUkTableRow>
              <GovUkTableCell header>IP Address</GovUkTableCell>
              <GovUkTableCell header>Reason</GovUkTableCell>
              <GovUkTableCell header>Blocked At</GovUkTableCell>
              <GovUkTableCell header>Unblock At</GovUkTableCell>
              <GovUkTableCell header>Failed Attempts</GovUkTableCell>
              <GovUkTableCell header>Actions</GovUkTableCell>
            </GovUkTableRow>
          </GovUkTableHead>
          <GovUkTableBody>
            {blockedIPs.map((ip) => (
              <GovUkTableRow key={ip.id}>
                <GovUkTableCell>{ip.ip || ip.hashedIP}</GovUkTableCell>
                <GovUkTableCell>{ip.reason}</GovUkTableCell>
                <GovUkTableCell>{new Date(ip.blockedAt).toLocaleString()}</GovUkTableCell>
                <GovUkTableCell>
                  {ip.unblockAt ? new Date(ip.unblockAt).toLocaleString() : 'Never'}
                </GovUkTableCell>
                <GovUkTableCell>{ip.failedAttempts}</GovUkTableCell>
                <GovUkTableCell>
                  <Tooltip title="Unblock IP">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleUnblockIP(ip.ip || ip.hashedIP)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </GovUkTableCell>
              </GovUkTableRow>
            ))}
          </GovUkTableBody>
        </GovUkTable>
        
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />

        <BlockIPDialog
          open={blockDialogOpen}
          onClose={() => setBlockDialogOpen(false)}
          onBlock={handleBlockIP}
        />
      </Box>
    </Box>
  );
}; 