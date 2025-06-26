import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Box,
  Container,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { ActiveUpload } from '../types';
import { getAuthHeaders } from '../utils/api';
import ActiveUploadsDisplay from '../components/ActiveUploadsDisplay';

const AdminUploadMonitor: React.FC = () => {
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [_socket, setSocket] = useState<Socket | null>(null); //query this 
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Add loading state
  const navigate = useNavigate();

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // Effect for WebSocket connection and listeners
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return; // Don't proceed if not authenticated

    setLoading(true); // Start loading
    setError(null); // Clear previous errors

    // Function to fetch initial active uploads
    const fetchActiveUploads = async () => {
      try {
        const headers = getAuthHeaders(); // Use the helper function
        const response = await fetch(`${API_URL}/admin/active-uploads`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch active uploads: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
          setActiveUploads(data.data);
          console.log('Fetched initial active uploads:', data.data);
        } else {
          throw new Error(data.message || 'Failed to fetch active uploads');
        }
      } catch (err) {
        console.error("Error fetching active uploads:", err);
        setError(err instanceof Error ? err.message : 'Could not fetch active uploads');
      } finally {
         setLoading(false); // Stop loading after fetch attempt
      }
    };

    // Initialize Socket.IO connection
    const socketInstance = io(API_URL.replace('/api', ''), {
      transports: ['websocket', 'polling'], // Explicitly allow both transports
      withCredentials: true,
      path: '/socket.io/admin/', // Specify the namespaced path
      // Add authentication if implemented on backend
      // auth: { token: token }
    });

    setSocket(socketInstance);
    console.log('Attempting to connect WebSocket for upload monitoring...');

    socketInstance.on('connect', () => {
      console.log('WebSocket connected for upload monitoring:', socketInstance.id);
      socketInstance.emit('join_admin_room');
      console.log('Attempted to join admin_updates room');
      fetchActiveUploads(); // Fetch initial state
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setError('WebSocket disconnected. Attempting to reconnect...');
      // Handle reconnection logic if needed
    });

    socketInstance.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError(`WebSocket connection failed: ${err.message}`);
       setLoading(false); // Stop loading on connection error
    });

    // Listener for progress updates
    socketInstance.on('upload_progress_update', (update: ActiveUpload) => {
      console.log('Received upload_progress_update:', update);
      setActiveUploads(prevUploads => {
        const existingIndex = prevUploads.findIndex(upload => upload.id === update.id);
        let newUploads = [...prevUploads];

        if (update.isComplete) {
          if (existingIndex !== -1) {
            newUploads.splice(existingIndex, 1);
            console.log(`Removed completed upload: ${update.fileName}`);
          }
        } else if (existingIndex !== -1) {
          newUploads[existingIndex] = { ...newUploads[existingIndex], ...update };
          // console.log(`Updated existing upload: ${update.fileName} to ${update.percentage?.toFixed(1)}%`);
        } else {
          newUploads.push(update);
          console.log(`Added new upload: ${update.fileName}`);
        }
        newUploads.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        return newUploads;
      });
    });

    // Cleanup on component unmount
    return () => {
      console.log('Disconnecting WebSocket...');
      socketInstance.off('connect');
      socketInstance.off('disconnect');
      socketInstance.off('connect_error');
      socketInstance.off('upload_progress_update');
      socketInstance.disconnect();
      setSocket(null);
    };
  }, []); // Run once on mount

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="div">
        Active Upload Monitor
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
         <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading active uploads...</Typography>
         </Box>
      ) : (
        <ActiveUploadsDisplay uploads={activeUploads} />
      )}
    </Container>
  );
};

export default AdminUploadMonitor;
