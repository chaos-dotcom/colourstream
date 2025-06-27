import { Request, Response } from 'express';
import express from 'express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
// import crypto from 'crypto';

const router = express.Router();

/**
 * Generate a signature for stream authentication
 * Kept for future use but currently not used
 */
/*
function generateSignature(streamKey: string): string {
  const secret = process.env.OME_SIGNATURE_SECRET || 'colourstream-signature-key';
  return crypto.createHmac('sha1', secret).update(streamKey).digest('hex');
}
*/

/**
 * OvenMediaEngine Webhook for validating stream keys
 * For details see: https://airensoft.gitbook.io/ovenmediaengine/access-control/admission-webhooks
 */
router.post('/admission', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    logger.info('AdmissionWebhook received request', { body });

    // Protocol and URL analysis
    if (
      body.request &&
      body.request.url &&
      body.request.direction &&
      body.request.status === 'opening'
    ) {
      const request = body.request;
      const url = new URL(request.url);
      const protocolLower = request.protocol?.toLowerCase() || '';
      let streamKey: string | undefined | null;

      if (protocolLower === 'srt') {
        const streamId = url.searchParams.get('streamid');
        if (streamId) {
          const streamIdParts = streamId.split('/');
          streamKey = streamIdParts[streamIdParts.length - 1];
        }
      } else {
        // Default behavior for RTMP, WebRTC
        const pathParts = url.pathname.split('/');
        streamKey = pathParts[pathParts.length - 1];
      }

      if (!streamKey) {
        logger.warn('Could not extract stream key from admission request', { url: request.url });
        return res.json({ allowed: false, reason: 'Stream key could not be determined from request URL' });
      }
      
      logger.info('Processing stream key', { 
        streamKey,
        protocol: request.protocol,
        direction: request.direction,
        url: request.url 
      });
      
      // Development mode bypass - allow any stream key
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('DEVELOPMENT MODE: Allowing any stream key for testing', { streamKey });
        
        return res.json({
          allowed: true,
          new_url: request.url,
          lifetime: 3600000,
          reason: 'Development mode - all streams allowed'
        });
      }

      // Find an active room with this stream key
      const room = await prisma.room.findFirst({
        where: {
          streamKey: streamKey,
          expiryDate: {
            gt: new Date()
          }
        }
      });

      if (!room) {
        logger.warn('Stream key not found in database', { streamKey });
        return res.json({
          allowed: false,
          reason: 'Invalid stream key'
        });
      }

      logger.info('Valid stream key for room', { roomId: room.id, streamKey });
      
      // Format response based on protocol to ensure proper WebRTC signaling
      // Convert protocol to lowercase for case-insensitive comparison
      const protocolLower = request.protocol?.toLowerCase() || '';
      
      if (protocolLower === 'webrtc') {
        logger.info('Handling WebRTC connection', { 
          originalUrl: request.url,
          protocol: request.protocol,
          direction: request.direction
        });
        
        return res.json({
          allowed: true,
          new_url: request.url,
          lifetime: 3600000 // Set a default lifetime of 1 hour
        });
      } else {
        // For non-WebRTC protocols (RTMP, SRT, etc.)
        logger.info('Handling non-WebRTC connection', {
          protocol: request.protocol,
          direction: request.direction
        });
        
        return res.json({
          allowed: true,
          new_url: request.url
        });
      }
    } else if (body.request && body.request.status === 'closing') {
      // Stream is closing - just acknowledge
      return res.json({ allowed: true });
    } else {
      logger.warn('Invalid webhook request format', { body });
      return res.status(400).json({
        allowed: false,
        reason: 'Invalid request format'
      });
    }
  } catch (error) {
    logger.error('Error in admission webhook', { error });
    return res.status(500).json({
      allowed: false,
      reason: 'Internal server error'
    });
  }
});

export default router; 
