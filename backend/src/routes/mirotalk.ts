import express, { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';

const router = express.Router();

type StringValue = string & { __brand: 'StringValue' };

interface MiroTalkJoinRequest {
  room: string;
  name: string;
  audio: string;
  video: string;
  screen: string;
  hide: string;
  notify: string;
  token: {
    username: string;
    password: string;
    presenter: string;
    expire?: string;
  };
}

// Helper function to convert expiration time to seconds
function getExpirationInSeconds(expireValue: string | undefined): number {
  if (!expireValue) return 3600; // Default 1 hour
  
  const match = expireValue.match(/^(\d+)([hd])$/);
  if (!match) return 3600;
  
  const [, value, unit] = match;
  const numValue = parseInt(value, 10);
  
  if (unit === 'h') return numValue * 3600;
  if (unit === 'd') return numValue * 24 * 3600;
  
  return 3600;
}

// Create MiroTalk meeting URL
router.post('/join', authenticateToken, async (req: Request<{}, {}, MiroTalkJoinRequest>, res: Response, next: NextFunction) => {
  try {
    const { room, name, audio, video, screen, hide, notify, token } = req.body;

    if (!process.env.JWT_KEY) {
      throw new AppError(500, 'JWT_KEY environment variable is not set');
    }

    // Construct token payload
    const tokenPayload = {
      username: token.username,
      password: token.password,
      presenter: token.presenter,
    };

    // Encrypt payload using AES
    const payloadString = JSON.stringify(tokenPayload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, process.env.JWT_KEY).toString();

    // Create JWT token with numeric expiration in seconds
    const expirationTime = getExpirationInSeconds(token.expire || process.env.JWT_EXP);
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      process.env.JWT_KEY,
      { expiresIn: expirationTime }
    );

    // Construct MiroTalk URL
    const mirotalkUrl = new URL('https://video.colourstream.johnrogerscolour.co.uk/join');
    mirotalkUrl.searchParams.append('room', room);
    mirotalkUrl.searchParams.append('name', name);
    mirotalkUrl.searchParams.append('audio', audio);
    mirotalkUrl.searchParams.append('video', video);
    mirotalkUrl.searchParams.append('screen', screen);
    mirotalkUrl.searchParams.append('hide', hide);
    mirotalkUrl.searchParams.append('notify', notify);
    mirotalkUrl.searchParams.append('token', jwtToken);
    mirotalkUrl.searchParams.append('_', Date.now().toString());
    mirotalkUrl.searchParams.append('fresh', '1');

    logger.info('Generated MiroTalk URL', {
      room,
      name,
      presenter: token.presenter,
      url: mirotalkUrl.toString()
    });

    res.json({
      status: 'success',
      data: {
        url: mirotalkUrl.toString()
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router; 