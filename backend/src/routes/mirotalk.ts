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

interface GenerateTokenRequest {
  roomId: string;
  name: string;
  isPresenter: boolean;
  expireTime?: string;
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

    if (!process.env.COLOURSTREAM_MIROTALK_JWT_KEY) {
      throw new AppError(500, 'COLOURSTREAM_MIROTALK_JWT_KEY environment variable is not set');
    }

    // Construct token payload - ensure presenter is "true" or "1" as string
    const tokenPayload = {
      username: token.username,
      password: token.password,
      presenter: token.presenter === "1" || token.presenter === "true" ? "true" : "false",
      expire: token.expire || "24h"
    };

    logger.debug('Creating MiroTalk token with payload', {
      username: tokenPayload.username,
      presenter: tokenPayload.presenter,
      expire: tokenPayload.expire
    });

    // Encrypt payload using AES
    const payloadString = JSON.stringify(tokenPayload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, process.env.COLOURSTREAM_MIROTALK_JWT_KEY).toString();

    // Create JWT token with string expiration format as expected by MiroTalk
    // Convert the string expire value to a number of seconds for jwt.sign
    const expireInSeconds = getExpirationInSeconds(tokenPayload.expire);
    
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      process.env.COLOURSTREAM_MIROTALK_JWT_KEY || '',
      { expiresIn: expireInSeconds }
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
      presenter: tokenPayload.presenter,
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

// Generate one-time token for guests or presenters
router.post('/generate-token', authenticateToken, async (req: Request<{}, {}, GenerateTokenRequest>, res: Response, next: NextFunction) => {
  try {
    const { roomId, name, isPresenter, expireTime = "1d" } = req.body;

    if (!process.env.COLOURSTREAM_MIROTALK_JWT_KEY) {
      throw new AppError(500, 'COLOURSTREAM_MIROTALK_JWT_KEY environment variable is not set');
    }

    // Get username and password from environment or use default
    let username = 'globalUsername';
    let password = 'globalPassword';
    
    try {
      if (process.env.HOST_USERS) {
        // Remove any surrounding quotes that might be included in the env var
        const cleanedHostUsers = process.env.HOST_USERS.replace(/^['"]|['"]$/g, '');
        const parsedUsers = JSON.parse(cleanedHostUsers);
        if (parsedUsers && parsedUsers.length > 0) {
          username = parsedUsers[0].username;
          password = parsedUsers[0].password;
        }
      }
    } catch (parseError) {
      logger.error('Error parsing HOST_USERS environment variable:', parseError);
      // Continue with default values
    }

    // Construct token payload
    const tokenPayload = {
      username,
      password,
      presenter: isPresenter ? "true" : "false",
      expire: expireTime
    };

    logger.debug('Creating one-time token with payload', {
      username: tokenPayload.username,
      presenter: tokenPayload.presenter,
      expire: tokenPayload.expire
    });

    // Encrypt payload using AES
    const payloadString = JSON.stringify(tokenPayload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, process.env.COLOURSTREAM_MIROTALK_JWT_KEY).toString();

    // Create JWT token
    const expireInSeconds = getExpirationInSeconds(tokenPayload.expire);
    
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      process.env.COLOURSTREAM_MIROTALK_JWT_KEY || '',
      { expiresIn: expireInSeconds }
    );

    // Construct MiroTalk URL
    const mirotalkUrl = new URL('https://video.colourstream.johnrogerscolour.co.uk/join');
    mirotalkUrl.searchParams.append('room', roomId);
    mirotalkUrl.searchParams.append('name', name);
    mirotalkUrl.searchParams.append('audio', 'true');
    mirotalkUrl.searchParams.append('video', 'true');
    mirotalkUrl.searchParams.append('screen', 'false');
    mirotalkUrl.searchParams.append('hide', 'false');
    mirotalkUrl.searchParams.append('notify', 'true');
    mirotalkUrl.searchParams.append('token', jwtToken);
    mirotalkUrl.searchParams.append('_', Date.now().toString());
    mirotalkUrl.searchParams.append('fresh', '1');

    logger.info('Generated one-time token URL', {
      room: roomId,
      name,
      presenter: tokenPayload.presenter,
      url: mirotalkUrl.toString()
    });

    res.json({
      status: 'success',
      data: {
        url: mirotalkUrl.toString(),
        token: jwtToken,
        expiresIn: expireInSeconds
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router; 