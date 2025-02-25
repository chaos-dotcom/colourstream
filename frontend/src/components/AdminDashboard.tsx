import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Tab,
  Tabs,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  TablePagination,
} from '@mui/material';
import { Visibility, VisibilityOff, ContentCopy, PlayArrow, OpenInNew, Videocam, Key, Delete, Logout, Block } from '@mui/icons-material';
import { createRoom, getRooms, deleteRoom, cleanupExpiredRooms, Room, CreateRoomData, setOBSStreamKey, registerPasskey, PasskeyInfo, getPasskeys, removePasskey, adminLogout, stopOBSStream } from '../utils/api';
import { api } from '../utils/api';
import { OBSSettings } from './settings/OBSSettings';
import { OvenMediaConfig } from './OvenMediaConfig';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

interface ExtendedRoom extends Room {
  mirotalkRoomId: string;
  streamKey: string;
  displayPassword: string;
}

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

const AdminDashboard: React.FC = () => {
  const [rooms, setRooms] = useState<ExtendedRoom[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mainTabValue, setMainTabValue] = useState(0);
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({});
  const [visibleMirotalkIds, setVisibleMirotalkIds] = useState<{ [key: string]: boolean }>({});
  const [visibleStreamKeys, setVisibleStreamKeys] = useState<{ [key: string]: boolean }>({});
  const [newRoom, setNewRoom] = useState<CreateRoomData>({
    name: '',
    password: '',
    expiryDays: 30,
  });
  const [registering, setRegistering] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const handleMainTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setMainTabValue(newValue);
  };

  const togglePasswordVisibility = (roomId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const toggleMirotalkIdVisibility = (roomId: string) => {
    setVisibleMirotalkIds(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const toggleStreamKeyVisibility = (roomId: string) => {
    setVisibleStreamKeys(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`${type} copied to clipboard`);
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms.map(room => ({
        ...room,
        mirotalkRoomId: room.mirotalkRoomId || '',
        streamKey: room.streamKey || '',
        displayPassword: room.displayPassword || '',
      })));
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    const fetchPasskeys = async () => {
      try {
        setLoadingPasskeys(true);
        const fetchedPasskeys = await getPasskeys();
        setPasskeys(fetchedPasskeys);
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to fetch passkeys');
      } finally {
        setLoadingPasskeys(false);
      }
    };
    
    if (mainTabValue === 3) {
      fetchPasskeys();
    }
  }, [mainTabValue]);

  const handleCreateRoom = async () => {
    if (!newRoom.name || !newRoom.password) {
      setError('Room name and password are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createRoom(newRoom);
      setSuccess('Room created successfully');
      setOpenDialog(false);
      setNewRoom({
        name: '',
        password: '',
        expiryDays: 30,
      });
      await fetchRooms();
    } catch (error: any) {
      console.error('Failed to create room:', error);
      setError(error?.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogClose = () => {
    if (!loading) {
      setOpenDialog(false);
      setError(null);
      setNewRoom({
        name: '',
        password: '',
        expiryDays: 30,
      });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      setLoading(true);
      await deleteRoom(roomId);
      setSuccess('Room deleted successfully');
      fetchRooms();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete room');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupExpired = async () => {
    try {
      setLoading(true);
      const result = await cleanupExpiredRooms();
      const { deletedCount } = result.data;
      setSuccess(`Cleaned up ${deletedCount} expired rooms`);
      fetchRooms();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cleanup expired rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async (room: ExtendedRoom) => {
    try {
      setLoading(true);
      await setOBSStreamKey(room.streamKey);
      window.open(`${room.link}?password=${encodeURIComponent(room.displayPassword)}`, '_blank');
      setSuccess('Stream key set in OBS and room opened');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to set stream key in OBS');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    try {
      setRegistering(true);
      setError(null);
      await registerPasskey();
      setSuccess('Passkey registered successfully');
      const updatedPasskeys = await getPasskeys();
      setPasskeys(updatedPasskeys);
    } catch (error: any) {
      setError(error.message || 'Failed to register passkey');
    } finally {
      setRegistering(false);
    }
  };

  const handleRemovePasskey = async (credentialId: string) => {
    try {
      setLoading(true);
      await removePasskey(credentialId);
      setSuccess('Passkey removed successfully');
      const updatedPasskeys = await getPasskeys();
      setPasskeys(updatedPasskeys);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to remove passkey');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    adminLogout();
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleBlockIP = async (ip: string, reason: string, duration?: number) => {
    try {
      setLoading(true);
      await api.post('/security/block-ip', { ip, reason, duration });
      setSuccess('IP blocked successfully');
      fetchBlockedIPs();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to block IP');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      setLoading(true);
      await api.post('/security/unblock-ip', { ip });
      setSuccess('IP unblocked successfully');
      fetchBlockedIPs();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to unblock IP');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedIPs = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/security/blocked-ips?page=${page + 1}&limit=${rowsPerPage}`);
      setBlockedIPs(response.data.data.blockedIPs);
      setTotal(response.data.data.pagination.total);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to fetch blocked IPs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mainTabValue === 3) {
      fetchBlockedIPs();
    }
  }, [mainTabValue, page, rowsPerPage]);

  return (
    <Container 
      sx={{ 
        maxWidth: '1800px !important',
        width: '95%',
        mt: 2
      }}
    >
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        mb: 3,
        backgroundColor: 'background.paper',
        padding: 1,
        borderRadius: 1,
      }}>
        <Button
          variant="contained"
          color="error"
          size="large"
          onClick={async () => {
            try {
              await stopOBSStream();
              setSuccess('Stream stopped successfully');
            } catch (error: any) {
              setError(error.response?.data?.message || 'Failed to stop stream');
            }
          }}
          sx={{ 
            height: 48,
            fontSize: '1rem',
            fontWeight: 'bold',
            minWidth: '160px'
          }}
        >
          Stop Stream
        </Button>
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={<Logout />}
          onClick={handleLogout}
          sx={{ 
            height: 48,
            fontSize: '1rem',
            fontWeight: 'bold',
            minWidth: '160px'
          }}
        >
          Logout
        </Button>
      </Box>

      <Typography variant="h4" component="h1" gutterBottom>
        Admin Dashboard
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mainTabValue} onChange={handleMainTabChange} aria-label="admin dashboard tabs">
          <Tab label="ROOMS" />
          <Tab label="OVEN MEDIA" />
          <Tab label="SECURITY" />
          <Tab label="OBS SETTINGS" />
        </Tabs>
      </Box>

      <TabPanel value={mainTabValue} index={0}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setOpenDialog(true)}
            disabled={loading}
          >
            Create New Room
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleCleanupExpired}
            disabled={loading}
          >
            Cleanup Expired Rooms
          </Button>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Link</TableCell>
                <TableCell>Mirotalk Room ID</TableCell>
                <TableCell>Stream Key</TableCell>
                <TableCell>Password</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell>{room.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title="Copy link">
                        <IconButton size="small" onClick={() => handleCopy(room.link, 'Link')}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy link with password">
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopy(`${room.link}?password=${encodeURIComponent(room.displayPassword)}`, 'Link with password')}
                        >
                          <ContentCopy color="primary" fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy formatted template">
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopy(`Link:   ${room.link}\nPassword: ${room.displayPassword}\n`, 'Formatted template')}
                        >
                          <ContentCopy color="secondary" fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open in new tab">
                        <IconButton 
                          size="small" 
                          onClick={() => window.open(room.link, '_blank')}
                        >
                          <OpenInNew fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>
                        {visibleMirotalkIds[room.id] ? room.mirotalkRoomId : '••••••'}
                      </Typography>
                      <Tooltip title={visibleMirotalkIds[room.id] ? "Hide Mirotalk Room ID" : "Show Mirotalk Room ID"}>
                        <IconButton
                          size="small"
                          onClick={() => toggleMirotalkIdVisibility(room.id)}
                        >
                          {visibleMirotalkIds[room.id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy Mirotalk Room ID">
                        <IconButton size="small" onClick={() => handleCopy(room.mirotalkRoomId, 'Mirotalk Room ID')}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>
                        {visibleStreamKeys[room.id] ? room.streamKey : '••••••'}
                      </Typography>
                      <Tooltip title={visibleStreamKeys[room.id] ? "Hide Stream Key" : "Show Stream Key"}>
                        <IconButton
                          size="small"
                          onClick={() => toggleStreamKeyVisibility(room.id)}
                        >
                          {visibleStreamKeys[room.id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy Stream Key">
                        <IconButton size="small" onClick={() => handleCopy(room.streamKey, 'Stream Key')}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Set in OBS">
                        <IconButton
                          size="small"
                          onClick={async () => {
                            try {
                              setLoading(true);
                              await setOBSStreamKey(room.streamKey);
                              setSuccess('Stream key set in OBS successfully');
                            } catch (error: any) {
                              setError(error.response?.data?.message || 'Failed to set stream key in OBS');
                            } finally {
                              setLoading(false);
                            }
                          }}
                        >
                          <PlayArrow fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography>
                        {visiblePasswords[room.id] ? room.displayPassword : '••••••'}
                      </Typography>
                      <Tooltip title={visiblePasswords[room.id] ? "Hide password" : "Show password"}>
                        <IconButton
                          size="small"
                          onClick={() => togglePasswordVisibility(room.id)}
                        >
                          {visiblePasswords[room.id] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Copy password">
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopy(room.displayPassword, 'Password')}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>{new Date(room.expiryDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={loading}
                      >
                        Delete
                      </Button>
                      <Tooltip title="Set OBS and open room">
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleGoLive(room)}
                          disabled={loading}
                          startIcon={<Videocam />}
                        >
                          Go Live
                        </Button>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      <TabPanel value={mainTabValue} index={1}>
        <OvenMediaConfig />
      </TabPanel>

      <TabPanel value={mainTabValue} index={2}>
        <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">IP Security</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Block />}
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
                              <Delete />
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
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Passkey Management
                </Typography>
              </Box>
              
              <Typography variant="body1" color="text.secondary" paragraph>
                Passkeys provide a more secure way to authenticate without passwords. They use biometric authentication or device PIN.
              </Typography>

              {loadingPasskeys ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  {passkeys.length > 0 && (
                    <List>
                      {passkeys.map((passkey, index) => (
                        <React.Fragment key={passkey.id}>
                          {index > 0 && <Divider />}
                          <ListItem>
                            <ListItemText
                              primary={`Passkey ${index + 1}`}
                              secondary={`Last used: ${new Date(passkey.lastUsed).toLocaleString()}`}
                            />
                            <ListItemSecondaryAction>
                              <Tooltip title="Remove passkey">
                                <IconButton
                                  edge="end"
                                  onClick={() => handleRemovePasskey(passkey.credentialId)}
                                  disabled={loading}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </ListItemSecondaryAction>
                          </ListItem>
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </>
              )}
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Key />}
                onClick={handleRegisterPasskey}
                disabled={registering || loading}
              >
                {registering ? 'Registering...' : 'Register New Passkey'}
              </Button>
            </CardActions>
          </Card>
        </Box>
      </TabPanel>

      <TabPanel value={mainTabValue} index={3}>
        <Box sx={{ maxWidth: 600, mx: 'auto' }}>
          <OBSSettings />
        </Box>
      </TabPanel>

      <Dialog open={openDialog} onClose={handleDialogClose}>
        <DialogTitle>Create New Room</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Room Name"
            fullWidth
            value={newRoom.name}
            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
            disabled={loading}
            required
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={newRoom.password}
            onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
            disabled={loading}
            required
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Expiry Period</InputLabel>
            <Select
              value={newRoom.expiryDays}
              onChange={(e) => setNewRoom({ ...newRoom, expiryDays: Number(e.target.value) })}
              disabled={loading}
            >
              <MenuItem value={7}>1 Week</MenuItem>
              <MenuItem value={30}>1 Month</MenuItem>
              <MenuItem value={90}>3 Months</MenuItem>
              <MenuItem value={180}>6 Months</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateRoom} 
            variant="contained" 
            color="primary" 
            disabled={loading || !newRoom.name || !newRoom.password}
          >
            {loading ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <BlockIPDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        onBlock={handleBlockIP}
      />

      {error && (
        <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
          <Alert onClose={() => setError(null)} severity="error">
            {error}
          </Alert>
        </Snackbar>
      )}

      {success && (
        <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess(null)}>
          <Alert onClose={() => setSuccess(null)} severity="success">
            {success}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
};

export default AdminDashboard;

function BlockIPDialog({ open, onClose, onBlock }: BlockIPDialogProps): JSX.Element {
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
} 