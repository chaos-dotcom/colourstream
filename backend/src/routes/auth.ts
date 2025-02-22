import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { AppError } from '../middleware/errorHandler';

const router = express.Router();

router.post(
  '/login',
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
      const storedHash = process.env.ADMIN_PASSWORD_HASH;

      if (!storedHash) {
        throw new AppError(500, 'Admin password hash not configured');
      }

      const isValid = await bcrypt.compare(password, storedHash);

      if (!isValid) {
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

export default router; 