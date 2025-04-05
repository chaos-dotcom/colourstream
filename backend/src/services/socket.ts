import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { logger } from '../utils/logger';
// Define allowed origins for Socket.IO CORS, mirroring index.ts
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://live.colourstream.johnrogerscolour.co.uk',
  'http://localhost:8000', // Allow local dev frontend
  'https://upload.colourstream.johnrogerscolour.co.uk' // Allow upload portal origin
];

let io: SocketIOServer | null = null;

export const initializeSocketIO = (httpServer: http.Server): SocketIOServer => {
  if (io) {
    logger.warn('Socket.IO already initialized.');
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins, // Use the defined origins
      methods: ["GET", "POST"], // Methods needed by Socket.IO
      credentials: true
    },
    // Use a specific path for the backend Socket.IO instance to avoid conflicts
    path: '/socket.io/admin/'
  });

  logger.info('Socket.IO server initialized.');

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    // console.log(`Socket connected: ${socket.id}`); // More verbose logging if needed

    // Handle admin room joining
    socket.on('join_admin_room', () => {
      // TODO: Add authentication/authorization check here if needed
      // For now, directly join the room
      socket.join('admin_updates');
      logger.info(`Socket ${socket.id} joined room 'admin_updates'`);
      // Optionally send confirmation back to client
      // socket.emit('joined_admin_room_ack');
    });

    // Handle other specific events from this client if necessary
    // e.g., socket.on('join_admin_room', () => { socket.join('admin_updates'); });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id}, Reason: ${reason}`);
      // console.log(`Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });

    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
        // console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer | null => {
  if (!io) {
    logger.warn('Attempted to get Socket.IO instance before initialization.');
  }
  return io;
};

// Optional: Add cleanup logic if needed, though Socket.IO often handles this
export const cleanupSocketIO = () => {
    if (io) {
        io.close((err) => {
            if (err) {
                logger.error('Error closing Socket.IO server:', err);
            } else {
                logger.info('Socket.IO server closed.');
            }
        });
        io = null;
    }
};