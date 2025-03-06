import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { AppError } from './errorHandler';

interface JwtPayload {
  userId: string;
  type: 'admin' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        type: string;
        oidc?: {
          sub: string;
          provider: string;
        };
      };
      oidc: {
        user?: any;
        isAuthenticated?: () => boolean;
        idTokenClaims?: any;
      };
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

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Authentication failed: No token provided');
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_AUTH_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Authentication failed: Invalid token', { error });
    return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
  }
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.type !== 'admin') {
    logger.warn('Authorization failed: Admin access required', { user: req.user });
    return res.status(403).json({ status: 'error', message: 'Admin access required' });
  }
  next();
}

export function isOIDCAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.oidc || !req.oidc.isAuthenticated || !req.oidc.isAuthenticated()) {
    logger.warn('OIDC Authentication failed: User not authenticated');
    return res.status(401).json({ status: 'error', message: 'OIDC authentication required' });
  }
  next();
} 