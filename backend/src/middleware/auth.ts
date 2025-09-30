import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database-sqlite';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: any;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No authorization token provided',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    const result = await query('SELECT * FROM issuers WHERE did = ? AND is_active = 1', [decoded.did]);

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid or inactive issuer',
      });
      return;
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    if (roles.includes('issuer') && req.user.is_active) {
      next();
      return;
    }

    if (roles.includes('admin') && req.user.is_admin) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
    });
  };
}