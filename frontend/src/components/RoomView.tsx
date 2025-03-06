import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import Cookies from 'js-cookie';
import { validateRoomAccess, RoomConfig, generateMirotalkToken, TokenGenerationRequest } from '../utils/api';
import { 
  OVENPLAYER_SCRIPT_URL, 
  WEBRTC_WS_HOST, 
  WEBRTC_WS_PORT, 
  WEBRTC_WS_PROTOCOL, 
  WEBRTC_APP_PATH,
  VIDEO_URL 
} from '../config';

export interface RoomViewProps {
  isPasswordProtected?: boolean;
  isPresenter?: boolean;
}

const RoomView: React.FC<RoomViewProps> = ({ isPasswordProtected = false, isPresenter: propIsPresenter = false }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  
  // Check for presenter status in query parameters (using a more secure parameter name)
  const queryParams = new URLSearchParams(location.search);
  const accessType = queryParams.get('access');
  const isPresenter = propIsPresenter || accessType === 'p';
  
  const [userName, setUserName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isNameSubmitted, setIsNameSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string>('');
  
  const [tokenDialogOpen, setTokenDialogOpen] = useState<boolean>(false);
  const [tokenName, setTokenName] = useState<string>('');
  const [tokenExpiry, setTokenExpiry] = useState<string>('1d');
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [isGeneratingToken, setIsGeneratingToken] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    const savedName = Cookies.get('userName');
    if (savedName) {
      setUserName(savedName);
    }

    // Check for password in URL parameters
    const urlPassword = queryParams.get('password');
    if (urlPassword) {
      setPassword(urlPassword);
      // If we have both username and password, auto-submit
      if (savedName && isPasswordProtected) {
        handleAutoSubmit(savedName, urlPassword);
      }
    }
  }, []);

  const handleAutoSubmit = async (name: string, pass: string) => {
    setError('');
    setLoading(true);

    try {
      if (roomId && isPasswordProtected) {
        const config = await validateRoomAccess(roomId, pass, isPresenter);
        setRoomConfig(config);
      }

      if (name.trim()) {
        Cookies.set('userName', name.trim(), { expires: 31 });
        setIsNameSubmitted(true);
      }
    } catch (error: any) {
      console.error('Room access error:', error);
      setError(error.message || 'Failed to join room. Please check your password and try again.');
      setIsNameSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAutoSubmit(userName, password);
  };

  // Initialize OvenPlayer
  useEffect(() => {
    if (!scriptRef.current && isNameSubmitted && roomConfig) {
      const script = document.createElement('script');
      script.src = OVENPLAYER_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const player = (window as any).OvenPlayer;
        if (player && player.create) {
          // Log stream key for debugging (will be removed in production)
          console.log('Stream key length:', roomConfig.streamKey?.length);
          
          // Construct the WebRTC URL with the stream key
          const wsHost = WEBRTC_WS_HOST;
          const wsPort = WEBRTC_WS_PORT;
          const wsProtocol = WEBRTC_WS_PROTOCOL;
          const appPath = WEBRTC_APP_PATH;
          const streamUrl = roomConfig.streamKey
            ? `${wsProtocol}://${wsHost}:${wsPort}/${appPath}/${roomConfig.streamKey}`
            : `${wsProtocol}://${wsHost}:${wsPort}/${appPath}/stream`;
            
          console.log('Using stream URL:', streamUrl);
          
          playerRef.current = player.create('player_id', {
            autoStart: true,
            mute: true,
            sources: [
              {
                label: 'Secure Live Stream',
                type: 'webrtc',
                file: streamUrl,
              }
            ]
          });
          
          playerRef.current.on('ready', () => {
            setIsPlayerReady(true);
          });
          
          // Add error event handler to debug connection issues
          playerRef.current.on('error', (error: any) => {
            console.error('OvenPlayer error:', error);
            setPlayerError(`Connection error: ${error.message || 'Failed to connect to stream'}`);
          });
        }
      };
      script.onerror = (error) => {
        console.error('Failed to load OvenPlayer:', error);
        setPlayerError('Failed to load video player');
      };
      scriptRef.current = script;
      document.head.appendChild(script);
    }

    return () => {
      if (scriptRef.current) {
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
        }
        document.head.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [isNameSubmitted, roomConfig]);

  // Initialize MiroTalk iframe after player is ready
  useEffect(() => {
    if (isNameSubmitted && isPlayerReady && iframeRef.current && roomConfig) {
      const timestamp = new Date().getTime();
      const baseUrl = VIDEO_URL;
      const queryParams = new URLSearchParams({
        room: roomConfig.mirotalkRoomId,
        name: userName,
        audio: '1',
        video: '1',
        screen: isPresenter ? '1' : '0',
        hide: '0',
        notify: '0',
        token: roomConfig.mirotalkToken,
        _: timestamp.toString(),
        fresh: '1',
        presenter: isPresenter ? '1' : '0'
      });
      iframeRef.current.src = `${baseUrl}?${queryParams.toString()}`;
    }
  }, [isNameSubmitted, isPlayerReady, userName, roomConfig, isPresenter]);

  const handleCloseTokenDialog = () => {
    setTokenDialogOpen(false);
    setGeneratedUrl('');
  };

  const handleGenerateToken = async (isPresenterToken: boolean) => {
    if (!roomConfig || !roomId) return;
    
    try {
      setIsGeneratingToken(true);
      setError('');
      
      const request: TokenGenerationRequest = {
        roomId: roomConfig.mirotalkRoomId,
        name: tokenName || 'Guest',
        isPresenter: isPresenterToken,
        expireTime: tokenExpiry
      };
      
      const response = await generateMirotalkToken(request);
      setGeneratedUrl(response.data.url);
      setSuccessMessage(`${isPresenterToken ? 'Presenter' : 'Guest'} link generated successfully`);
    } catch (error: any) {
      setError(error.response?.data?.message || `Failed to generate ${isPresenterToken ? 'presenter' : 'guest'} link`);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Link copied to clipboard');
  };

  if (!isNameSubmitted) {
    return (
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Typography component="h1" variant="h5" align="center" gutterBottom>
              Join Stream
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={loading}
                autoFocus
              />
              {isPasswordProtected && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Room Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!error}
                  helperText={error}
                  disabled={loading}
                />
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Join Stream'}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        id="player_id"
        style={{
          flex: '1',
          minHeight: 0,
          width: '100%',
          position: 'relative',
        }}
      >
        {playerError && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              p: 2,
              borderRadius: 1,
              textAlign: 'center',
              maxWidth: '80%',
            }}
          >
            <Typography variant="body1">{playerError}</Typography>
          </Box>
        )}
      </div>
      {isPlayerReady && (
        <iframe
          ref={iframeRef}
          title="Mirotalk Call"
          allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay"
          style={{
            width: '100%',
            height: '30vh',
            border: 'none',
            overflow: 'hidden',
            display: 'block',
          }}
        />
      )}

      {/* Token Generation Dialog */}
      <Dialog open={tokenDialogOpen} onClose={handleCloseTokenDialog} maxWidth="md" fullWidth>
        <DialogTitle>Generate Token Links for {roomId}</DialogTitle>
        <DialogContent>
          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          {successMessage && (
            <Typography color="success.main" sx={{ mt: 2 }}>
              {successMessage}
            </Typography>
          )}
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
            
            {generatedUrl && (
              <Box sx={{ mt: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  fullWidth
                  value={generatedUrl}
                  label="Generated Link"
                  InputProps={{
                    readOnly: true,
                  }}
                />
                <Tooltip title="Copy link">
                  <IconButton onClick={() => handleCopy(generatedUrl)}>
                    <ContentCopy />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handleGenerateToken(true)} 
            variant="contained" 
            color="primary"
            disabled={isGeneratingToken}
          >
            Generate Presenter Link
          </Button>
          <Button 
            onClick={() => handleGenerateToken(false)} 
            variant="contained"
            disabled={isGeneratingToken}
          >
            Generate Guest Link
          </Button>
          <Button onClick={handleCloseTokenDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoomView; 