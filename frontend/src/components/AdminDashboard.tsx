import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Container,
  Snackbar,
} from '@mui/material';
import { Delete, ContentCopy, Visibility, VisibilityOff, PlayArrow, OpenInNew, Link } from '@mui/icons-material';
import { OBSSettings } from './settings/OBSSettings';
import { OvenMediaConfig } from './OvenMediaConfig';
import {
  Button as GovUkButton,
  PageHeading,
  SectionHeading,
  InsetText,
  WarningText,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from './GovUkComponents';
import { createRoom, getRooms, deleteRoom, cleanupExpiredRooms, Room, CreateRoomData, setOBSStreamKey, registerPasskey, PasskeyInfo, getPasskeys, removePasskey, adminLogout, stopOBSStream, generateMirotalkToken, TokenGenerationRequest } from '../utils/api';
import { api } from '../utils/api';

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
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ExtendedRoom | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState('1d');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

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

  const handleOpenTokenDialog = (room: ExtendedRoom) => {
    setSelectedRoom(room);
    setTokenName('');
    setTokenExpiry('1d');
    setGeneratedUrl('');
    setTokenDialogOpen(true);
  };

  const handleCloseTokenDialog = () => {
    setTokenDialogOpen(false);
    setSelectedRoom(null);
    setGeneratedUrl('');
  };

  const handleGenerateToken = async (isPresenter: boolean) => {
    if (!selectedRoom) return;
    
    try {
      setIsGeneratingToken(true);
      setError(null);
      
      const request: TokenGenerationRequest = {
        roomId: selectedRoom.mirotalkRoomId,
        name: tokenName || 'Guest',
        isPresenter,
        expireTime: tokenExpiry
      };
      
      const response = await generateMirotalkToken(request);
      setGeneratedUrl(response.data.url);
      setSuccess(`${isPresenter ? 'Presenter' : 'Guest'} link generated successfully`);
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to generate ${isPresenter ? 'presenter' : 'guest'} link`);
    } finally {
      setIsGeneratingToken(false);
    }
  };

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
        <GovUkButton 
          variant="warning"
          onClick={async () => {
            try {
              await stopOBSStream();
              setSuccess('Stream stopped successfully');
            } catch (error: any) {
              setError(error.response?.data?.message || 'Failed to stop stream');
            }
          }}
        >
          Stop Stream
        </GovUkButton>
        <GovUkButton
          variant="grey"
          onClick={handleLogout}
        >
          Logout
        </GovUkButton>
      </Box>

      <PageHeading caption="Silly But Secure Administration Portal">
        Admin Dashboard
      </PageHeading>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mainTabValue} onChange={handleMainTabChange} aria-label="admin dashboard tabs">
          <Tab label="ROOMS" />
          <Tab label="OVEN MEDIA" />
          <Tab label="SECURITY" />
          <Tab label="OBS SETTINGS" />
        </Tabs>
      </Box>

      <TabPanel value={mainTabValue} index={0}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
              <SectionHeading>Room Management</SectionHeading>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <GovUkButton
                  variant="primary"
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
              </Box>
            </Box>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            )}

            <Box sx={{ 
              mb: 4,
              border: '1px solid #b1b4b6'
            }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell header={true}>Name</TableCell>
                    <TableCell header={true}>Link</TableCell>
                    <TableCell header={true}>Mirotalk Room ID</TableCell>
                    <TableCell header={true}>Stream Key</TableCell>
                    <TableCell header={true}>Password</TableCell>
                    <TableCell header={true}>Expiry Date</TableCell>
                    <TableCell header={true}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell>{room.name}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Tooltip title="Copy link">
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(`${window.location.origin}/room/${room.id}`, 'Room link')}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Open in new tab">
                            <IconButton
                              size="small"
                              component="a"
                              href={`/room/${room.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {visibleMirotalkIds[room.id] ? (
                            <>
                              {room.mirotalkRoomId}
                              <IconButton
                                size="small"
                                onClick={() => toggleMirotalkIdVisibility(room.id)}
                              >
                                <VisibilityOff fontSize="small" />
                              </IconButton>
                            </>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={() => toggleMirotalkIdVisibility(room.id)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {visibleStreamKeys[room.id] ? (
                            <>
                              {room.streamKey}
                              <IconButton
                                size="small"
                                onClick={() => toggleStreamKeyVisibility(room.id)}
                              >
                                <VisibilityOff fontSize="small" />
                              </IconButton>
                              <Tooltip title="Copy stream key">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopy(room.streamKey, 'Stream key')}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={() => toggleStreamKeyVisibility(room.id)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {visiblePasswords[room.id] ? (
                            <>
                              {room.displayPassword}
                              <IconButton
                                size="small"
                                onClick={() => togglePasswordVisibility(room.id)}
                              >
                                <VisibilityOff fontSize="small" />
                              </IconButton>
                              <Tooltip title="Copy password">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopy(room.displayPassword, 'Password')}
                                >
                                  <ContentCopy fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={() => togglePasswordVisibility(room.id)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {room.expiryDate ? new Date(room.expiryDate).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Go live">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleGoLive(room)}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete room">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Generate Token Links">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenTokenDialog(room)}
                            >
                              <Link fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={mainTabValue} index={1}>
        <OvenMediaConfig />
      </TabPanel>

      <TabPanel value={mainTabValue} index={2}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <SectionHeading>IP Security</SectionHeading>
              <GovUkButton
                variant="primary"
                onClick={() => setBlockDialogOpen(true)}
              >
                Block IP
              </GovUkButton>
            </Box>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            )}

            <Box sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell header={true}>IP Address</TableCell>
                    <TableCell header={true}>Reason</TableCell>
                    <TableCell header={true}>Blocked At</TableCell>
                    <TableCell header={true}>Unblock At</TableCell>
                    <TableCell header={true}>Failed Attempts</TableCell>
                    <TableCell header={true}>Actions</TableCell>
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
                        <GovUkButton
                          variant="warning"
                          onClick={() => handleUnblockIP(ip.ip || ip.hashedIP)}
                        >
                          Unblock
                        </GovUkButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                alignItems: 'center', 
                mt: 2,
                p: 2,
                borderTop: '1px solid #b1b4b6'
              }}>
                <Box sx={{ mr: 2, color: '#0b0c0c' }}>
                  Rows per page:
                  <select
                    value={rowsPerPage}
                    onChange={(e) => handleChangeRowsPerPage({ target: { value: e.target.value } } as React.ChangeEvent<HTMLInputElement>)}
                    style={{ 
                      marginLeft: '8px',
                      padding: '4px 8px',
                      border: '2px solid #0b0c0c',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ mr: 2, color: '#0b0c0c' }}>
                    {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, total)} of {total}
                  </Box>
                  <GovUkButton
                    variant="secondary"
                    onClick={() => handleChangePage(null, page - 1)}
                    disabled={page === 0}
                  >
                    Previous
                  </GovUkButton>
                  <GovUkButton
                    variant="secondary"
                    onClick={() => handleChangePage(null, page + 1)}
                    disabled={page >= Math.ceil(total / rowsPerPage) - 1}
                  >
                    Next
                  </GovUkButton>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ borderTop: '1px solid #b1b4b6', pt: 6 }}>
            <SectionHeading>Passkey Management</SectionHeading>
            
            <InsetText>
              Passkeys provide a more secure way to authenticate without passwords. They use biometric authentication or device PIN.
            </InsetText>

            {loadingPasskeys ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {passkeys.length > 0 ? (
                  <Box sx={{ mb: 4, border: '1px solid #b1b4b6' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell header={true}>Passkey</TableCell>
                          <TableCell header={true}>Last Used</TableCell>
                          <TableCell header={true}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {passkeys.map((passkey, index) => (
                          <TableRow key={passkey.id}>
                            <TableCell>Passkey {index + 1}</TableCell>
                            <TableCell>{new Date(passkey.lastUsed).toLocaleString()}</TableCell>
                            <TableCell>
                              <GovUkButton
                                variant="warning"
                                onClick={() => handleRemovePasskey(passkey.credentialId)}
                                disabled={loading}
                              >
                                Remove
                              </GovUkButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <WarningText>
                    No passkeys registered. Register a passkey to enhance security.
                  </WarningText>
                )}
              </>
            )}
            
            <Box sx={{ mt: 4 }}>
              <GovUkButton
                variant="primary"
                onClick={handleRegisterPasskey}
                disabled={registering || loading}
              >
                {registering ? <CircularProgress size={24} color="inherit" /> : 'Register New Passkey'}
              </GovUkButton>
            </Box>
          </Box>
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
          <GovUkButton 
            variant="secondary" 
            onClick={handleDialogClose} 
            disabled={loading}
          >
            Cancel
          </GovUkButton>
          <GovUkButton 
            variant="primary" 
            onClick={handleCreateRoom} 
            disabled={loading || !newRoom.name || !newRoom.password}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Create'}
          </GovUkButton>
        </DialogActions>
      </Dialog>

      <BlockIPDialog
        open={blockDialogOpen}
        onClose={() => setBlockDialogOpen(false)}
        onBlock={handleBlockIP}
      />

      <Dialog open={tokenDialogOpen} onClose={handleCloseTokenDialog} maxWidth="md" fullWidth>
        <DialogTitle>Generate Token Links for {selectedRoom?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Participant Name"
              fullWidth
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              margin="normal"
              placeholder="Enter participant name (optional)"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Token Expiry</InputLabel>
              <Select
                value={tokenExpiry}
                onChange={(e) => setTokenExpiry(e.target.value)}
                label="Token Expiry"
              >
                <MenuItem value="1h">1 Hour</MenuItem>
                <MenuItem value="6h">6 Hours</MenuItem>
                <MenuItem value="12h">12 Hours</MenuItem>
                <MenuItem value="1d">1 Day</MenuItem>
                <MenuItem value="7d">7 Days</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <GovUkButton
                variant="primary"
                onClick={() => handleGenerateToken(true)}
                disabled={isGeneratingToken}
              >
                Generate Presenter Link
              </GovUkButton>
              
              <GovUkButton
                variant="secondary"
                onClick={() => handleGenerateToken(false)}
                disabled={isGeneratingToken}
              >
                Generate Guest Link
              </GovUkButton>
            </Box>
            
            {isGeneratingToken && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <CircularProgress />
              </Box>
            )}
            
            {generatedUrl && (
              <Box sx={{ mt: 3, p: 2, bgcolor: '#f3f2f1', borderLeft: '5px solid #1d70b8' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    fullWidth
                    value={generatedUrl}
                    InputProps={{ readOnly: true }}
                    variant="outlined"
                  />
                  <Tooltip title="Copy link">
                    <IconButton
                      onClick={() => {
                        navigator.clipboard.writeText(generatedUrl);
                        setSuccess('Link copied to clipboard');
                      }}
                    >
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open in new tab">
                    <IconButton
                      component="a"
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <OpenInNew />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <InsetText>
                    This is a one-time token link that will expire after {tokenExpiry}. 
                    Share this link with the participant to give them access to the meeting.
                  </InsetText>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <GovUkButton variant="secondary" onClick={handleCloseTokenDialog}>
            Close
          </GovUkButton>
        </DialogActions>
      </Dialog>

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
        <GovUkButton variant="secondary" onClick={onClose}>Cancel</GovUkButton>
        <GovUkButton variant="primary" onClick={handleSubmit} disabled={!ip || !reason}>Block</GovUkButton>
      </DialogActions>
    </Dialog>
  );
} 