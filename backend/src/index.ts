import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import obsRoutes from './routes/obs';
import { logger } from './utils/logger';

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://live.colourstream.johnrogerscolour.co.uk',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Get base path from environment variable
const basePath = process.env.BASE_PATH || '';

// Routes with base path
app.use(`${basePath}/auth`, authRoutes);
app.use(`${basePath}/rooms`, roomRoutes);
app.use(`${basePath}/obs`, obsRoutes);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
}); 