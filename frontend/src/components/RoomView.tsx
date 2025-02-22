import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { validateRoomAccess, RoomConfig } from '../utils/api';

interface RoomViewProps {
  isPasswordProtected?: boolean;
}

const RoomView: React.FC<RoomViewProps> = ({ isPasswordProtected = false }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const [userName, setUserName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isNameSubmitted, setIsNameSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const savedName = Cookies.get('userName');
    if (savedName) {
      setUserName(savedName);
    }

    // Check for password in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlPassword = urlParams.get('password');
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
        const config = await validateRoomAccess(roomId, pass);
        setRoomConfig(config);
      }

      if (name.trim()) {
        Cookies.set('userName', name.trim(), { expires: 31 });
        setIsNameSubmitted(true);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to join room');
      setIsNameSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAutoSubmit(userName, password);
  };

  useEffect(() => {
    if (!scriptRef.current && isNameSubmitted) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.js';
      script.async = true;
      script.onload = () => {
        const player = (window as any).OvenPlayer;
        if (player && player.create) {
          player.create('player_id', {
            autoStart: true,
            mute: true,
            sources: [
              {
                label: 'Secure Live Stream',
                type: 'webrtc',
                file: roomConfig?.streamKey
                  ? `wss://live.colourstream.johnrogerscolour.co.uk:3334/app/${roomConfig.streamKey}`
                  : 'wss://live.colourstream.johnrogerscolour.co.uk:3334/app/stream',
              }
            ]
          });
        }
      };
      script.onerror = (error) => {
        console.error('Failed to load OvenPlayer:', error);
      };
      scriptRef.current = script;
      document.head.appendChild(script);
    }

    return () => {
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [isNameSubmitted, roomConfig]);

  useEffect(() => {
    if (isNameSubmitted && iframeRef.current) {
      const timestamp = new Date().getTime();
      const baseUrl = 'https://video.colourstream.johnrogerscolour.co.uk/join';
      const queryParams = new URLSearchParams({
        room: roomConfig?.mirotalkRoomId || 'test',
        name: userName,
        audio: '1',
        video: '1',
        screen: '0',
        hide: '0',
        notify: '0',
        _: timestamp.toString(),
        fresh: '1'
      });
      iframeRef.current.src = `${baseUrl}?${queryParams.toString()}`;
    }
  }, [isNameSubmitted, userName, roomConfig]);

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
        }}
      />
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
    </Box>
  );
};

export default RoomView; 