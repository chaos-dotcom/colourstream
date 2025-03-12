import express from 'express';
import { TusdHooksController } from '../controllers/tusdHooksController';

const router = express.Router();
const tusdHooksController = new TusdHooksController();

// tusd webhook routes
router.post('/pre-create', tusdHooksController.handlePreCreate);
router.post('/post-create', tusdHooksController.handlePostCreate);
router.post('/post-receive', tusdHooksController.handlePostReceive);
router.post('/post-finish', tusdHooksController.handlePostFinish);
router.post('/post-terminate', tusdHooksController.handlePostTerminate);

export default router; 