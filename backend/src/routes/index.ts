import express from 'express';
import authRoutes from './auth';
import roomsRoutes from './rooms';
import securityRoutes from './security';
import obsRoutes from './obs';
import omenRoutes from './omen';
import mirotalkRoutes from './mirotalk';
import omeWebhookRoutes from './omeWebhook';
import uploadRoutes from './upload';
import tusHookRoutes from './tusHookRoutes'; // Import the new Tus hook routes


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/rooms', roomsRoutes);
router.use('/security', securityRoutes);
router.use('/obs', obsRoutes);
router.use('/omen', omenRoutes);
router.use('/mirotalk', mirotalkRoutes);
router.use('/ome-webhook', omeWebhookRoutes);
router.use('/upload', uploadRoutes);
router.use('/upload', tusHookRoutes); // Mount Tus hook routes under /upload

export default router; 
