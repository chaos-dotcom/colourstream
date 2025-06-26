import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ContentCopy,
  OpenInNew,
  Link as LinkIcon
} from '@mui/icons-material';
import { 
  getRooms, 
  createRoom, 
  deleteRoom, 
  cleanupExpiredRooms,
  setOBSStreamKey,
  stopOBSStream
} from '../../utils/api';
import { 
  Button as GovUkButton, 
  Table as GovUkTable,
  TableHead as GovUkTableHead,
  TableBody as GovUkTableBody,
  TableRow as GovUkTableRow,
  TableCell as GovUkTableCell,
  InsetText
} from '../GovUkComponents';

interface Room {
  id: string;
  name: string;
  streamKey: string;
  password: string;
  displayPassword: string;
  expiryDate: string;
  link: string;
  presenterLink: string | null;
}

// Function to generate a secure random password
const generateSecurePassword = (length = 12) => {
  // Only use alphanumeric characters for easy selection with double-click
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  
  // Create a typed array of random values
  const randomValues = new Uint8Array(length);
  // Fill with cryptographically secure random values
  window.crypto.getRandomValues(randomValues);
  
  // Convert random values to characters from our charset
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }
  
  return password;
};

const RoomManagement: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    expiryDays: 7
  });
  const [visibleStreamKeys, setVisibleStreamKeys] = useState<Record<string, boolean>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [streamingRoomId, setStreamingRoomId] = useState<string | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const response = await getRooms();
      setRooms(response);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoom.name) {
      setError('Room name is required');
      return;
    }

    setLoading(true);
    try {
      // Generate a secure random password
      const securePassword = generateSecurePassword();
      
      await createRoom({
        name: newRoom.name,
        password: securePassword,
        expiryDays: newRoom.expiryDays
      });
      setSuccess('Room created successfully with a secure random password');
      setOpenDialog(false);
      setNewRoom({
        name: '',
        expiryDays: 7
      });
      fetchRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('Are you sure you want to delete this room?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteRoom(roomId);
      setSuccess('Room deleted successfully');
      fetchRooms();
    } catch (error) {
      console.error('Error deleting room:', error);
      setError('Failed to delete room');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupExpired = async () => {
    if (!window.confirm('Are you sure you want to clean up expired rooms?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await cleanupExpiredRooms();
      setSuccess(`Cleaned up ${response.data.deletedCount} expired rooms`);
      fetchRooms();
    } catch (error) {
      console.error('Error cleaning up rooms:', error);
      setError('Failed to clean up expired rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async (room: Room) => {
    setLoading(true);
    try {
      await setOBSStreamKey(room.streamKey);
      setStreamingRoomId(room.id);
      setSuccess('Stream started successfully');
    } catch (error) {
      console.error('Error starting stream:', error);
      setError('Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  const handleStopStream = async () => {
    setLoading(true);
    try {
      await stopOBSStream();
      setStreamingRoomId(null);
      setSuccess('Stream stopped successfully');
    } catch (error) {
      console.error('Error stopping stream:', error);
      setError('Failed to stop stream');
    } finally {
      setLoading(false);
    }
  };

  const toggleStreamKeyVisibility = (roomId: string) => {
    setVisibleStreamKeys(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const togglePasswordVisibility = (roomId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }));
  };

  const handleCopy = (text: string, itemName: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setSuccess(`${itemName} copied to clipboard`);
      })
      .catch(() => {
        setError(`Failed to copy ${itemName}`);
      });
  };

  // New function to copy formatted link and password
  const handleCopyFormattedLinkAndPassword = (link: string, password: string) => {
    const formattedText = `Link: ${link}\nPassword: ${password}`;
    navigator.clipboard.writeText(formattedText)
      .then(() => {
        setSuccess('Link and password copied to clipboard');
      })
      .catch(() => {
        setError('Failed to copy link and password');
      });
  };

  // Update the function to get presenter link with password
  const getPresenterLinkWithPassword = (room: Room) => {
    // Check if the presenterLink already has query parameters
    const hasQueryParams = room.presenterLink?.includes('?');
    // Add password parameter to the link
    return `${room.presenterLink}${hasQueryParams ? '&' : '?'}password=${room.password}`;
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
    setNewRoom({
      name: '',
      expiryDays: 7
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <GovUkButton
            variant="green"
            onClick={() => setOpenDialog(true)}
            disabled={loading}
          >
            Create New Room
          </GovUkButton>
          <GovUkButton
            variant="purple"
            onClick={handleCleanupExpired}
            disabled={loading}
          >
            Cleanup Expired Rooms
          </GovUkButton>
          {streamingRoomId && (
            <GovUkButton
              variant="red"
              onClick={handleStopStream}
              disabled={loading}
            >
              Stop OBS Stream
            </GovUkButton>
          )}
        </Box>
      </Box>

      <InsetText>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>How Room Links Work</Typography>
        <Typography variant="body2">
          <strong>Guest Link:</strong> Share this link with viewers who only need to watch the stream.
        </Typography>
        <Typography variant="body2">
          <strong>Presenter Link:</strong> Share this link with presenters who need to control the stream and share their screen. The password is automatically included in the link.
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Both links automatically use the room's token with appropriate permissions. Users will be prompted to enter their name when they access the link.
        </Typography>
      </InsetText>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <GovUkTable caption="Room Management">
        <GovUkTableHead>
          <GovUkTableRow>
            <GovUkTableCell header>Name</GovUkTableCell>
            <GovUkTableCell header>Guest Link</GovUkTableCell>
            <GovUkTableCell header>Presenter Link</GovUkTableCell>
            <GovUkTableCell header>Stream Key</GovUkTableCell>
            <GovUkTableCell header>Password</GovUkTableCell>
            <GovUkTableCell header>Expiry Date</GovUkTableCell>
            <GovUkTableCell header>Actions</GovUkTableCell>
          </GovUkTableRow>
        </GovUkTableHead>
        <GovUkTableBody>
          {rooms.map((room) => (
            <GovUkTableRow key={room.id} selected={streamingRoomId === room.id}>
              <GovUkTableCell>{room.name}</GovUkTableCell>
              <GovUkTableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Copy formatted link and password">
                    <IconButton onClick={() => handleCopyFormattedLinkAndPassword(room.link, room.password)}>
                      <LinkIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </GovUkTableCell>
              <GovUkTableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {room.presenterLink ? (
                    <>
                      <Tooltip title="Copy presenter link with password">
                        <IconButton onClick={() => handleCopy(getPresenterLinkWithPassword(room), 'Presenter link')}>
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Open presenter link with password">
                        <IconButton onClick={() => window.open(getPresenterLinkWithPassword(room), '_blank')}>
                          <OpenInNew />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    'N/A'
                  )}
                </Box>
              </GovUkTableCell>
              <GovUkTableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {visibleStreamKeys[room.id] ? room.streamKey : '••••••••••••'}
                  </Typography>
                  <Tooltip title={visibleStreamKeys[room.id] ? 'Hide stream key' : 'Show stream key'}>
                    <IconButton onClick={() => toggleStreamKeyVisibility(room.id)}>
                      {visibleStreamKeys[room.id] ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy stream key">
                    <IconButton onClick={() => handleCopy(room.streamKey, 'Stream key')}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
              </GovUkTableCell>
              <GovUkTableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ fontFamily: 'monospace' }}
                  >
                    {visiblePasswords[room.id] ? room.password : '••••••'}
                  </Typography>
                  <Tooltip title={visiblePasswords[room.id] ? 'Hide password' : 'Show password'}>
                    <IconButton onClick={() => togglePasswordVisibility(room.id)}>
                      {visiblePasswords[room.id] ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy password">
                    <IconButton onClick={() => handleCopy(room.password, 'Password')}>
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
              </GovUkTableCell>
              <GovUkTableCell>{new Date(room.expiryDate).toLocaleDateString()}</GovUkTableCell>
              <GovUkTableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {streamingRoomId === room.id ? (
                    <GovUkButton
                      variant="red"
                      onClick={handleStopStream}
                    >
                      Stop Stream
                    </GovUkButton>
                  ) : (
                    <GovUkButton
                      variant="teal"
                      onClick={() => handleGoLive(room)}
                      disabled={!!streamingRoomId}
                    >
                      Go Live
                    </GovUkButton>
                  )}
                  <GovUkButton
                    variant="red"
                    onClick={() => handleDeleteRoom(room.id)}
                  >
                    Delete
                  </GovUkButton>
                </Box>
              </GovUkTableCell>
            </GovUkTableRow>
          ))}
        </GovUkTableBody>
      </GovUkTable>

      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Room</DialogTitle>
        <DialogContent>
          <TextField
            label="Room Name"
            fullWidth
            value={newRoom.name}
            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            label="Expiry (days)"
            type="number"
            fullWidth
            value={newRoom.expiryDays}
            onChange={(e) => setNewRoom({ ...newRoom, expiryDays: parseInt(e.target.value) })}
            margin="normal"
            InputProps={{ inputProps: { min: 1, max: 30 } }}
          />
        </DialogContent>
        <DialogActions>
          <GovUkButton variant="secondary" onClick={handleDialogClose}>
            Cancel
          </GovUkButton>
          <GovUkButton variant="green" onClick={handleCreateRoom} disabled={loading}>
            Create
          </GovUkButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
      
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Box>
  );
};

export default RoomManagement; 
