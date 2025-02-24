import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { AppError } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { updatePasswordHash } from '../utils/updateEnvFile';
import { loginLimiter, trackLoginAttempts } from '../middleware/security';

const router = express.Router();

router.post(
  '/login',
  loginLimiter,
  trackLoginAttempts,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminPassword) {
        throw new AppError(500, 'Admin password not configured');
      }

      if (password !== adminPassword) {
        throw new AppError(401, 'Invalid password');
      }

      const token = jwt.sign(
        { userId: 'admin' },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );

      res.json({
        status: 'success',
        data: {
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/change-password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'Validation error');
      }

      const { currentPassword, newPassword } = req.body;
      const storedHash = process.env.ADMIN_PASSWORD_HASH;

      if (!storedHash) {
        throw new AppError(500, 'Admin password hash not configured');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, storedHash);
      if (!isValid) {
        throw new AppError(401, 'Current password is incorrect');
      }

      // Generate new hash
      const newHash = await bcrypt.hash(newPassword, 12);

      // Update .env file
      await updatePasswordHash(newHash);

      // Update environment variable
      process.env.ADMIN_PASSWORD_HASH = newHash;

      res.json({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router; 