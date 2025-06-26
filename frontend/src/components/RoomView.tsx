import React, { 
  useEffect, 
  useRef, 
  useState 
} from 'react';
import { 
  useParams, 
  useLocation 
} from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  CircularProgress,
} from '@mui/material';
import Cookies from 'js-cookie';
import { 
  validateRoomAccess, 
  RoomConfig 
} from '../utils/api';
import {
  OVENPLAYER_SCRIPT_URL,
  WEBRTC_WS_HOST,
  WEBRTC_WS_PORT,
  WEBRTC_WS_PROTOCOL,
  WEBRTC_APP_PATH,
  VIDEO_URL,
  TURN_SERVER_USERNAME,
  TURN_SERVER_CREDENTIAL,
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

  // Removed state variables for token generation dialog

  const scriptRef = useRef<HTMLScriptElement | null>(null); // For OvenPlayer script
  const iframeRef = useRef<HTMLIFrameElement>(null); // Ref for the Mirotalk iframe
  const playerRef = useRef<any>(null); // For OvenPlayer instance

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
      // Fetch room config only if password protected or explicitly needed
      let config: RoomConfig | null = null;
      if (roomId) {
         if (isPasswordProtected) {
            config = await validateRoomAccess(roomId, pass, isPresenter);
         } else {
             config = await validateRoomAccess(roomId, '', isPresenter); // Pass empty string for password if not protected
         }
         setRoomConfig(config);
      }

      if (name.trim()) {
        Cookies.set('userName', name.trim(), { expires: 31 });
        setIsNameSubmitted(true);
      } else {
         if (config) {
            setIsNameSubmitted(true);
         }
      }
    } catch (error: any) {
      console.error('Room access error:', error);
      setError(error.message || 'Failed to join room. Please check credentials or room details.');
      setIsNameSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAutoSubmit(userName, password);
  };

  // Initialize OvenPlayer Script & Instance
  useEffect(() => {
    if (!scriptRef.current && isNameSubmitted && roomConfig) {
      const script = document.createElement('script');
      script.src = OVENPLAYER_SCRIPT_URL;
      script.async = true;

      script.onload = async () => {
        const player = (window as any).OvenPlayer;
        if (player && player.create) {
          console.log('Stream key length:', roomConfig.streamKey?.length);

          const wsHost = WEBRTC_WS_HOST;
          const wsPort = WEBRTC_WS_PORT;
          const wsProtocol = WEBRTC_WS_PROTOCOL;
          const appPath = WEBRTC_APP_PATH;

          const streamUrl = roomConfig.streamKey
            ? `${wsProtocol}://${wsHost}:${wsPort}/${appPath}/${roomConfig.streamKey}`
            : `${wsProtocol}://${wsHost}:${wsPort}/${appPath}/stream`;

          console.log('Using stream URL:', streamUrl);

          const videoUrlHostname = new URL(VIDEO_URL).hostname;
          const stunTurnPort = 3478;

          playerRef.current = player.create('player_id', {
            autoStart: true,
            mute: true,
            webrtcConfig: {
              iceServers: [
                {
                  urls: [
                    `stun:${videoUrlHostname}:${stunTurnPort}`,
                    `turn:${videoUrlHostname}:${stunTurnPort}?transport=udp`,
                    `turn:${videoUrlHostname}:${stunTurnPort}?transport=tcp`,
                  ],
                  username: TURN_SERVER_USERNAME,
                  credential: TURN_SERVER_CREDENTIAL,
                }
              ],
              debug: true
            },
            sources: [
              {
                label: 'WebRTC Stream',
                type: 'webrtc',
                file: streamUrl
              }
            ]
          });

          playerRef.current.on('ready', () => {
            setIsPlayerReady(true);
            console.log('OvenPlayer ready - attempting to connect to stream');
          });

          playerRef.current.on('stateChanged', (state: any) => {
            console.log('Player state changed:', state);
            if (state && state.newstate === 'playing') {
              setPlayerError('');
            }
          });

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

    // Cleanup OvenPlayer Script & Instance
    return () => {
      if (scriptRef.current) {
        if (playerRef.current) {
          playerRef.current.remove();
          playerRef.current = null;
          console.log('OvenPlayer instance removed.');
        }
        if (scriptRef.current.parentNode === document.head) {
           document.head.removeChild(scriptRef.current);
        }
        scriptRef.current = null;
      }
    };
  }, [isNameSubmitted, roomConfig]);


  // Initialize MiroTalk iframe by setting src (Original approach)
  useEffect(() => {
    // Set iframe src only when authenticated, player is ready, iframe ref exists, and config is loaded
    if (isNameSubmitted && isPlayerReady && iframeRef.current && roomConfig) {
      const timestamp = new Date().getTime();
      const baseUrl = VIDEO_URL; // e.g., https://video.domain.com/join
      const queryParams = new URLSearchParams({
        room: roomConfig.mirotalkRoomId,
        name: userName || 'Guest', // Use Guest if username is empty
        audio: '1', // Enable audio
        video: '1', // Enable video
        screen: isPresenter ? '1' : '0', // Enable screen share for presenter
        hide: '0', // Don't hide self view
        notify: '0', // Disable notifications
        token: roomConfig.mirotalkToken, // Use the automatically fetched token
        _: timestamp.toString(), // Cache buster
        // Add any other necessary params from Mirotalk docs if needed
      });

      const iframeSrc = `${baseUrl}?${queryParams.toString()}`;
      console.log('Setting Mirotalk iframe src:', iframeSrc);
      iframeRef.current.src = iframeSrc;
    }
  // Dependencies: Re-run if auth status, player readiness, username, config, or presenter status changes
  }, [isNameSubmitted, isPlayerReady, userName, roomConfig, isPresenter]);

  // Removed handler functions for token generation dialog

  // --- Login Form ---
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
                  error={!!error && !loading}
                  helperText={!loading ? error : ''}
                  disabled={loading}
                />
              )}
              {error && !isPasswordProtected && !loading && (
                 <Typography color="error" sx={{ mt: 1, textAlign: 'center' }}>{error}</Typography>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !userName.trim()}
              >
                {loading ? <CircularProgress size={24} /> : 'Join Stream'}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  // --- Main Room View ---
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
      {/* OvenPlayer Container */}
      <div
        id="player_id"
        style={{
          flex: '1',
          minHeight: 0,
          width: '100%',
          position: 'relative',
          backgroundColor: '#000',
        }}
      >
        {playerError && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              p: 2,
              borderRadius: 1,
              textAlign: 'center',
              maxWidth: '80%',
              zIndex: 10
            }}
          >
            <Typography variant="body1">{playerError}</Typography>
          </Box>
        )}
        {/* Player initializes here */}
      </div>

      {/* Mirotalk Iframe Container - Renders only after name submission */}
      {/* We now render the iframe directly */}
      {isNameSubmitted && (
         <iframe
           ref={iframeRef}
           title="Mirotalk Call"
           allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay"
           style={{
             width: '100%',
             height: '30vh', // Fixed height for the Mirotalk section
             border: 'none',
             overflow: 'hidden',
             display: 'block',
             backgroundColor: '#f0f0f0' // Background while loading
           }}
           // src is set dynamically by the useEffect hook
         />
      )}
      {/* Removed Token Generation Dialog */}
    </Box>
  );
};

export default RoomView;
