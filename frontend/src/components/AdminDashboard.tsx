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
} from '@mui/material';
import { createRoom, getRooms, deleteRoom, cleanupExpiredRooms, Room, CreateRoomData } from '../utils/api';

const AdminDashboard: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState<CreateRoomData>({
    name: '',
    mirotalkRoomId: '',
    streamKey: '',
    password: '',
    expiryDays: 30,
  });

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);
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
    try {
      setLoading(true);
      await createRoom(newRoom);
      setSuccess('Room created successfully');
      setOpenDialog(false);
      setNewRoom({
        name: '',
        mirotalkRoomId: '',
        streamKey: '',
        password: '',
        expiryDays: 30,
      });
      fetchRooms();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Admin Dashboard
        </Typography>
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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Link</TableCell>
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
                      <Typography
                        sx={{
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {room.link}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText(room.link);
                          setSuccess('Link copied to clipboard');
                        }}
                      >
                        Copy
                      </Button>
                    </Box>
                  </TableCell>
                  <TableCell>{new Date(room.expiryDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={openDialog} onClose={() => !loading && setOpenDialog(false)}>
          <DialogTitle>Create New Room</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Room Name"
              fullWidth
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              disabled={loading}
            />
            <TextField
              margin="dense"
              label="Mirotalk Room ID"
              fullWidth
              value={newRoom.mirotalkRoomId}
              onChange={(e) => setNewRoom({ ...newRoom, mirotalkRoomId: e.target.value })}
              disabled={loading}
            />
            <TextField
              margin="dense"
              label="Stream Key"
              fullWidth
              value={newRoom.streamKey}
              onChange={(e) => setNewRoom({ ...newRoom, streamKey: e.target.value })}
              disabled={loading}
            />
            <TextField
              margin="dense"
              label="Password"
              type="password"
              fullWidth
              value={newRoom.password}
              onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
              disabled={loading}
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
            <Button onClick={() => setOpenDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} variant="contained" color="primary" disabled={loading}>
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
            severity={error ? 'error' : 'success'}
            onClose={() => {
              setError(null);
              setSuccess(null);
            }}
          >
            {error || success}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default AdminDashboard; 