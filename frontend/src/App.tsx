import { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Cookies from 'js-cookie';
import './App.css';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function RoomView() {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isNameSubmitted, setIsNameSubmitted] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [roomConfig, setRoomConfig] = useState<any>(null);

  // Check for existing name cookie on mount
  useEffect(() => {
    const savedName = Cookies.get('userName');
    if (savedName) {
      setUserName(savedName);
      setIsNameSubmitted(true);
    }
  }, []);

  // Add no-cache headers effect
  useEffect(() => {
    // Force reload if this is a back-navigation
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        window.location.reload();
      }
    });

    // Add meta tags for cache control
    const metaCache = document.createElement('meta');
    metaCache.httpEquiv = 'Cache-Control';
    metaCache.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(metaCache);

    const metaPragma = document.createElement('meta');
    metaPragma.httpEquiv = 'Pragma';
    metaPragma.content = 'no-cache';
    document.head.appendChild(metaPragma);

    const metaExpires = document.createElement('meta');
    metaExpires.httpEquiv = 'Expires';
    metaExpires.content = '0';
    document.head.appendChild(metaExpires);

    return () => {
      document.head.removeChild(metaCache);
      document.head.removeChild(metaPragma);
      document.head.removeChild(metaExpires);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      Cookies.set('userName', userName.trim(), { expires: 31 }); // Cookie expires in 31 days
      setIsNameSubmitted(true);
    }
  };

  useEffect(() => {
    if (!scriptRef.current && isNameSubmitted) {
      scriptRef.current = document.createElement('script');
      scriptRef.current.src = 'https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.js';
      scriptRef.current.async = true;
      scriptRef.current.onload = () => {
        // @ts-ignore
        window.OvenPlayer.create('player_id', {
          autoStart: true,
          mute: true,
          sources: [
            {
              label: 'Secure Live Stream',
              type: 'webrtc',
              file: roomConfig?.streamUrl || 'wss://live.colourstream.johnrogerscolour.co.uk:3334/app/stream'
            }
          ]
        });
      };
      document.head.appendChild(scriptRef.current);
    }

    return () => {
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [isNameSubmitted, roomConfig]);

  // Force iframe reload and ensure fresh state
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
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <h2 style={{ margin: '0 0 1rem 0', textAlign: 'center' }}>Enter Your Name</h2>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '4px',
                border: '1px solid #ddd',
                outline: 'none'
              }}
              autoFocus
            />
            <button
              type="submit"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Join Stream
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div id="player_id" style={{
        flex: '1',
        minHeight: 0,
        width: '100%'
      }}></div>
      <iframe
        ref={iframeRef}
        title="Mirotalk Call"
        allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay"
        style={{
          width: '100%',
          height: '30vh',
          border: 'none',
          overflow: 'hidden',
          display: 'block'
        }}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/room/:roomId" element={<RoomView />} />
        <Route path="/" element={<RoomView />} />
      </Routes>
    </Router>
  );
}

export default App;
