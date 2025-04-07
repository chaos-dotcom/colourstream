import express from 'express';
import { handleTusPostFinishHook } from '../controllers/tusHookController';

const router = express.Router();

// Route to handle incoming Tusd hooks
// Tusd sends POST requests for hooks
router.post('/tus-hook', handleTusPostFinishHook);

export default router;
