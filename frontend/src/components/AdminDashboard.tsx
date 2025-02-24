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
} from '@mui/material';
import { Visibility, VisibilityOff, ContentCopy, PlayArrow, OpenInNew, Videocam } from '@mui/icons-material';
import { createRoom, getRooms, deleteRoom, cleanupExpiredRooms, Room, CreateRoomData, setOBSStreamKey } from '../utils/api';
import { Settings } from './settings';
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
      await fetchRooms(); // Wait for rooms to be fetched
    } catch (error: any) {
      console.error('Failed to create room:', error);
      setError(error?.response?.data?.message || 'Failed to create room');
      // Keep dialog open on error
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

  return (
    <Container 
      sx={{ 
        maxWidth: '1800px !important',
        width: '95%'
      }}
    >
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Dashboard
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={mainTabValue} onChange={handleMainTabChange} aria-label="admin dashboard tabs">
            <Tab label="ROOMS" />
            <Tab label="SETTINGS" />
            <Tab label="OVEN MEDIA" />
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
          <Settings />
        </TabPanel>

        <TabPanel value={mainTabValue} index={2}>
          <OvenMediaConfig />
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

        <Snackbar
          open={!!error || !!success}
          autoHideDuration={6000}
          onClose={() => {
            setError(null);
            setSuccess(null);
          }}
        >
          <Alert
            onClose={() => {
              setError(null);
              setSuccess(null);
            }}
            severity={error ? 'error' : 'success'}
            sx={{ width: '100%' }}
          >
            {error || success}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default AdminDashboard; 