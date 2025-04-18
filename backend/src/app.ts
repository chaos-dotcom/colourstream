import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import uploadRoutes from './routes/uploadRoutes'; // Import the new upload routes
// Removed unused import: import { handleCompanionWebhook } from './controllers/companionWebhookController';
const app = express();

// Middleware
app.use(cors());

// Add detailed request logging BEFORE body parsing to find large payloads
// Prefix 'res' with '_' to indicate it's unused
app.use((req, _res, next) => { 
  const contentLength = req.headers['content-length'];
  console.log(`--> Incoming Request: ${req.method} ${req.originalUrl || req.url} - Content-Length: ${contentLength || 'Not specified'}`);
  // Optionally add a warning for very large content lengths
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) { // e.g., warn if > 10MB
    console.warn(`----> WARNING: Large Content-Length detected: ${contentLength} for ${req.method} ${req.originalUrl || req.url}`);
  }
  next();
});

// Increase JSON payload limit to 50MB
app.use(express.json({ limit: '50mb' }));
// Morgan logs after the request is handled, including status code
app.use(morgan('dev')); 

// Routes
app.use('/api', routes);
app.use('/api/upload', uploadRoutes); // Mount the upload-specific routes


export default app;
