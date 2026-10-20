import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, Role } from '../models/User';

export interface AuthPayload {
  userId: string;
  role: Role;
  tenantId?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ─── JWT Verify Middleware ────────────────────────────────────────────────────

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, env.jwt.secret) as AuthPayload;

    // Optional: verify user still exists and is active
    const user = await User.findById(decoded.userId).select('isActive');
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User account is deactivated' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    const err = error as Error;
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.substring(7), env.jwt.secret) as AuthPayload;
    } catch {
      req.user = undefined;
    }
  }
  next();
};

// ─── Role Authorization Middleware ────────────────────────────────────────────

export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const isSameCollege = (req: Request, tenantId: string): boolean => {
  return req.user?.tenantId === tenantId || req.user?.role === 'SUPER_ADMIN';
};
