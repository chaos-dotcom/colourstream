import { useEffect, useRef, useState } from 'react';
import './App.css';

function App() {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [isNameSubmitted, setIsNameSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
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
          sources: [
            {
              label: 'label_for_webrtc',
              type: 'webrtc',
              file: 'ws://ome_host:signaling_port/app/stream'
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
  }, [isNameSubmitted]);

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
      <div className="swal2-popup swal2-modal init-modal-size animate__animated animate__fadeInDown"
        style={{
          zIndex: 1000,
          position: 'relative'
        }}>
        {/* Your modal content goes here */}
      </div>
      <div id="player_id" style={{
        flex: '1',
        minHeight: 0,
        width: '100%'
      }}></div>
      <iframe
        title="Mirotalk Call"
        allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; web-share; autoplay"
        src={`https://video.colourstream.johnrogerscolour.co.uk/join?room=test&name=${userName}&audio=1&video=1&screen=0&hide=0&notify=0`}
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

export default App;
