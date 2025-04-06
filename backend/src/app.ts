import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
// Removed unused import: import { handleCompanionWebhook } from './controllers/companionWebhookController';
const app = express();

// Middleware
app.use(cors());
// Increase JSON payload limit to 50MB
app.use(express.json({ limit: '50mb' })); 
app.use(morgan('dev'));

// Routes
app.use('/api', routes);


export default app;
