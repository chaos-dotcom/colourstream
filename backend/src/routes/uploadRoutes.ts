import express from 'express';
import { handleTusHookEvent } from '../controllers/uploadController'; // Import the new controller function

const router = express.Router();

// Unified endpoint for all tusd hooks
router.post('/hook-event', handleTusHookEvent);

// TODO: Add other upload-related routes if needed (e.g., for S3 signing, link validation)
// Example: router.get('/upload-links/:token', validateUploadLinkController);
// Example: router.get('/s3/sts-token', getS3CredentialsController);
// Example: router.post('/progress/:token', handleFrontendProgressController); // If keeping frontend progress reporting

export default router;
