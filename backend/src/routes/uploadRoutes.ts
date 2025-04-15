import express from 'express';
import {
  // handleTusHookEvent, // Keep or remove based on whether other hooks call it
  handleProcessFinishedUpload, // Import the new controller function
  // handleNotifyCreated, // Add if implementing post-create notification endpoint
  // handleNotifyProgress, // Add if implementing post-receive notification endpoint
  // handleNotifyTerminated // Add if implementing post-terminate notification endpoint
} from '../controllers/uploadController';

const router = express.Router();

// New endpoint specifically for post-finish hook sending full .info data
router.post('/process-finished-upload', handleProcessFinishedUpload);

// Optional: Endpoints for other hooks if notifications are desired
// router.post('/notify-created', handleNotifyCreated);
// router.post('/notify-progress', handleNotifyProgress);
// router.post('/notify-terminated', handleNotifyTerminated);

// Keep the test connection endpoint
router.post('/test-connection', (req, res) => {
    console.log('Test connection received:', req.body);
    res.status(200).send({ message: 'Connection successful' });
});

// Remove or comment out the old unified hook endpoint if no longer used
// router.post('/hook-event', handleTusHookEvent);

// Other existing routes (examples)
// router.get('/upload-links/:token', validateUploadLinkController);
// router.get('/s3/sts-token', getS3CredentialsController);
// router.post('/progress/:token', handleFrontendProgressController);

export default router;
