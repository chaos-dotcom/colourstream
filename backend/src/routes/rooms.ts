import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';
import { RoomCreateBody, RoomCreateInput, RoomSelect } from '../types/room';

const router = express.Router();

interface ValidateRoomBody {
  password: string;
}

// Utility function to generate random IDs
const generateRandomId = (length: number = 12): string => {
  return crypto.randomBytes(length).toString('hex');
};

// Utility function to generate stream key
const generateStreamKey = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Utility function to generate MiroTalk token
const generateMiroTalkToken = async (roomId: string): Promise<string> => {
  try {
    if (!process.env.COLOURSTREAM_MIROTALK_JWT_KEY) {
      throw new Error('COLOURSTREAM_MIROTALK_JWT_KEY environment variable is not set');
    }
    
    // Use the same JWT_KEY as configured in MiroTalk
    const JWT_KEY = process.env.COLOURSTREAM_MIROTALK_JWT_KEY;
    
    // Format username as expected by MiroTalk
    const username = `room_${roomId}`;
    
    // Get password from environment or use default
    const password = process.env.HOST_USERS ? 
      JSON.parse(process.env.HOST_USERS)[0].password : 
      'globalPassword';

    // Constructing payload - MiroTalk expects presenter as a string "true" or "1"
    const payload = {
      username: username,
      password: password,
      presenter: "true", // MiroTalk expects "true" or "1" as a string
      expire: "24h"  // Match MiroTalk's expected format
    };

    // Encrypt payload using AES encryption
    const payloadString = JSON.stringify(payload);
    const encryptedPayload = CryptoJS.AES.encrypt(payloadString, JWT_KEY).toString();

    // Constructing JWT token with string expiration format as expected by MiroTalk
    const jwtToken = jwt.sign(
      { data: encryptedPayload },
      JWT_KEY,
      { expiresIn: "24h" } // Use string format as expected by MiroTalk
    );

    logger.info('Generated MiroTalk token', {
      roomId,
      username,
      tokenExpiry: "24h"
    });

    return jwtToken;
  } catch (error) {
    logger.error('Error generating MiroTalk token:', error);
    throw new AppError(500, 'Failed to generate MiroTalk token');
  }
};

// Middleware to validate room ID
const validateRoomId = [
  param('id').notEmpty().withMessage('Invalid room ID'),
];

// Middleware to validate room creation/update
const validateRoom = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('expiryDays').isInt({ min: 1 }).withMessage('Expiry days must be a positive number'),
];

// Create a new room (protected)
router.post(
  '/',
  authenticateToken,
  validateRoom,
  async (req: Request<{}, {}, RoomCreateBody>, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const { name, password, expiryDays } = req.body;

      // Generate random IDs
      const mirotalkRoomId = generateRandomId();
      const streamKey = generateStreamKey();

      // Generate MiroTalk token
      const mirotalkToken = await generateMiroTalkToken(mirotalkRoomId);

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const createData: RoomCreateInput = {
        name,
        mirotalkRoomId,
        streamKey,
        password: hashedPassword,
        displayPassword: password,
        expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        link: `${process.env.FRONTEND_URL}/room/${Math.random().toString(36).substr(2, 9)}`,
        mirotalkToken,
      };

      const room = await prisma.room.create({
        data: createData,
        select: {
          id: true,
          name: true,
          link: true,
          expiryDate: true,
          mirotalkRoomId: true,
          streamKey: true,
          displayPassword: true,
          mirotalkToken: true,
        } as RoomSelect,
      });

      res.status(201).json({
        status: 'success',
        data: { room },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all rooms (protected)
router.get(
  '/',
  authenticateToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rooms = await prisma.room.findMany({
        select: {
          id: true,
          name: true,
          link: true,
          expiryDate: true,
          mirotalkRoomId: true,
          streamKey: true,
          displayPassword: true,
        },
      });

      res.json({
        status: 'success',
        data: { rooms },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a room (protected)
router.delete(
  '/:id',
  authenticateToken,
  validateRoomId,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const room = await prisma.room.delete({
        where: { id: req.params.id },
      });

      if (!room) {
        throw new AppError(404, 'Room not found');
      }

      res.json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate room access (public)
router.post(
  '/validate/:id',
  [
    param('id').notEmpty().withMessage('Room ID is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request<{ id: string }, {}, ValidateRoomBody>, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const room = await prisma.room.findFirst({
        where: {
          link: { contains: req.params.id },
          expiryDate: { gt: new Date() },
        },
        select: {
          mirotalkRoomId: true,
          streamKey: true,
          mirotalkToken: true,
          password: true,
        } as RoomSelect,
      });

      if (!room) {
        throw new AppError(404, 'Room not found or expired');
      }

      const isValid = await bcrypt.compare(req.body.password, room.password);
      if (!isValid) {
        throw new AppError(401, 'Invalid password');
      }

      res.json({
        status: 'success',
        data: {
          mirotalkRoomId: room.mirotalkRoomId,
          streamKey: room.streamKey,
          mirotalkToken: room.mirotalkToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cleanup expired rooms (protected)
router.delete(
  '/cleanup/expired',
  authenticateToken,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await prisma.room.deleteMany({
        where: {
          expiryDate: { lt: new Date() },
        },
      });

      logger.info(`Cleaned up ${result.count} expired rooms`);

      res.json({
        status: 'success',
        data: {
          deletedCount: result.count,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router; 