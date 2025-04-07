import express from 'express';
import authRoutes from './auth';
import roomsRoutes from './rooms';
import securityRoutes from './security';
import obsRoutes from './obs';
import omenRoutes from './omen';
import mirotalkRoutes from './mirotalk';
import omeWebhookRoutes from './omeWebhook';
import uploadRoutes from './upload';
// Removed import for tusHookRoutes as it's handled by script hooks now
// import tusHookRoutes from './tusHookRoutes';


const router = express.Router();

router.use('/auth', authRoutes);
router.use('/rooms', roomsRoutes);
router.use('/security', securityRoutes);
router.use('/obs', obsRoutes);
router.use('/omen', omenRoutes);
router.use('/mirotalk', mirotalkRoutes);
router.use('/ome-webhook', omeWebhookRoutes);
router.use('/upload', uploadRoutes); // General upload routes (e.g., S3 STS)
// Removed route mounting for tusHookRoutes
// router.use('/upload', tusHookRoutes);

export default router;
