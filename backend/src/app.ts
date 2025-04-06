import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
// Removed unused import: import { handleCompanionWebhook } from './controllers/companionWebhookController';
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', routes);


export default app;