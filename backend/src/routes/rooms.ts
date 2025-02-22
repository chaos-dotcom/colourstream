import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

interface CreateRoomBody {
  name: string;
  mirotalkRoomId: string;
  streamKey: string;
  password: string;
  expiryDays: number;
}

interface ValidateRoomBody {
  password: string;
}

// Middleware to validate room ID
const validateRoomId = [
  param('id').notEmpty().withMessage('Invalid room ID'),
];

// Middleware to validate room creation/update
const validateRoom = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('mirotalkRoomId').notEmpty().withMessage('Mirotalk Room ID is required'),
  body('streamKey').notEmpty().withMessage('Stream Key is required'),
  body('password').notEmpty().withMessage('Password is required'),
  body('expiryDays').isInt({ min: 1 }).withMessage('Expiry days must be a positive number'),
];

// Create a new room (protected)
router.post(
  '/',
  authenticateToken,
  validateRoom,
  async (req: Request<{}, {}, CreateRoomBody>, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const { name, mirotalkRoomId, streamKey, password, expiryDays } = req.body;

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const room = await prisma.room.create({
        data: {
          name,
          mirotalkRoomId,
          streamKey,
          password: hashedPassword,
          expiryDate: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
          link: `${process.env.FRONTEND_URL}/room/${Math.random().toString(36).substr(2, 9)}`,
        },
        select: {
          id: true,
          name: true,
          link: true,
          expiryDate: true,
        },
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