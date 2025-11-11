import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, ipBlocker } from './middleware/security';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import obsRoutes from './routes/obs';
import omenRoutes from './routes/omen';
import securityRoutes from './routes/security';
import healthRoutes from './routes/health';
import omeWebhookRoutes from './routes/omeWebhook';
import uploadRoutes from './routes/upload';
import adminRoutes from './routes/admin'; // Import admin routes
import { logger } from './utils/logger';
import { initializePassword } from './utils/initPassword';
import mirotalkRoutes from './routes/mirotalk';
import WebSocketService from './services/websocket';
import OBSService from './services/obsService';
import { initializeOIDC, initializeOIDCMiddleware } from './services/oidc-express';
import { initializeTelegramService } from './services/telegram/initTelegram';
import { initializeSocketIO, cleanupSocketIO } from './services/socket'; // Import Socket.IO functions (removed unused getIO)

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);
// Initialize Socket.IO server
initializeSocketIO(server);

// Initialize OBS service with WebSocket service
export const obsService = new OBSService(wsService);

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://live.colourstream.colourbyrogers.co.uk', 
      'http://localhost:8000',
      'https://upload.colourstream.colourbyrogers.co.uk'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Tus-Resumable', 'Upload-Length', 'Upload-Metadata', 'Upload-Offset', 'X-Requested-With', 'X-HTTP-Method-Override'],
  exposedHeaders: ['Location', 'Tus-Resumable', 'Upload-Offset', 'Upload-Length']
};

// Security middleware
app.use(ipBlocker);
app.use(generalLimiter);

// Standard middleware
app.use(cors(corsOptions));
app.use(express.json());

// Get base path from environment variable
const basePath = process.env.BASE_PATH || '/api';

// Health check routes - no rate limiting or auth required
app.use(`${basePath}/health`, healthRoutes);

// Initialize OIDC middleware
// Moving this line to after OIDC initialization in startServer function
// initializeOIDCMiddleware(app);

// Routes with base path
app.use(`${basePath}/auth`, authRoutes);
app.use(`${basePath}/rooms`, roomRoutes);
app.use(`${basePath}/obs`, obsRoutes);
app.use(`${basePath}/omen`, omenRoutes);
app.use(`${basePath}/security`, securityRoutes);
app.use('/api/mirotalk', mirotalkRoutes);
app.use(`${basePath}/ome-webhook`, omeWebhookRoutes);
app.use(`${basePath}/upload`, uploadRoutes);
app.use(`${basePath}/admin`, adminRoutes); // Mount admin routes

// Import routes from the main routes file which includes tusd hooks
import routes from './routes';
app.use('/api', routes);

// Error handling
app.use(errorHandler);

const startServer = async () => {
  try {
    // Initialize the admin password hash
    await initializePassword();
    
    // Initialize OIDC
    const oidcInitialized = await initializeOIDC();
    if (oidcInitialized) {
      logger.info('OIDC initialized successfully');
      // Initialize OIDC middleware after configuration is loaded
      initializeOIDCMiddleware(app);
    } else {
      logger.warn('OIDC initialization failed, authentication will be limited to passkeys');
    }
    
    // Initialize Telegram bot for upload monitoring
    initializeTelegramService();
    
    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check available at ${basePath}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Cleanup on server shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Cleaning up...');
  wsService.cleanup();
  obsService.cleanup();
  cleanupSocketIO(); // Add Socket.IO cleanup
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Cleaning up...');
  wsService.cleanup();
  obsService.cleanup();
  cleanupSocketIO(); // Add Socket.IO cleanup
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default server; 