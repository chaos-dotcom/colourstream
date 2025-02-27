import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

interface JwtPayload {
  userId: string;
  type: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      type?: 'admin' | 'user';
    }
  }
}

export const verifyToken = async (token: string): Promise<JwtPayload> => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.ADMIN_AUTH_SECRET!
    ) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new AppError(401, 'Invalid or expired token');
  }
};

export const authenticateToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new AppError(401, 'Access token is required');
    }

    const decoded = await verifyToken(token);
    req.userId = decoded.userId;
    req.type = decoded.type;
    next();
  } catch (error) {
    next(new AppError(401, 'Invalid or expired token'));
  }
}; 