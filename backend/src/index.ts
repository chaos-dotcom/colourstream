import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter, ipBlocker } from './middleware/security';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import obsRoutes from './routes/obs';
import omenRoutes from './routes/omen';
import securityRoutes from './routes/security';
import { logger } from './utils/logger';

dotenv.config();

const app = express();

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://live.colourstream.johnrogerscolour.co.uk',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Security middleware
app.use(ipBlocker);
app.use(generalLimiter);

// Standard middleware
app.use(cors(corsOptions));
app.use(express.json());

// Get base path from environment variable
const basePath = process.env.BASE_PATH || '/api';

// Routes with base path
app.use(`${basePath}/auth`, authRoutes);
app.use(`${basePath}/rooms`, roomRoutes);
app.use(`${basePath}/obs`, obsRoutes);
app.use(`${basePath}/omen`, omenRoutes);
app.use(`${basePath}/security`, securityRoutes);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 