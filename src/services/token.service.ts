import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthPayload } from '../middleware/auth';
import { Role } from '../models/User';

export const tokenService = {
  /**
   * Generate a JWT access token
   */
  generateToken: (
    userId: string,
    role: Role,
    tenantId?: string
  ): string => {
    const payload: AuthPayload = { userId, role };
    if (tenantId) payload.tenantId = tenantId;

    return jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  },

  /**
   * Verify and decode a JWT token
   */
  verifyToken: (token: string): AuthPayload => {
    return jwt.verify(token, env.jwt.secret) as AuthPayload;
  },

  /**
   * Generate a password reset token (short-lived)
   */
  generateResetToken: (userId: string): string => {
    return jwt.sign({ userId, purpose: 'password_reset' }, env.jwt.secret, {
      expiresIn: '1h',
    });
  },

  /**
   * Verify a password reset token
   */
  verifyResetToken: (token: string): { userId: string } => {
    const decoded = jwt.verify(token, env.jwt.secret) as { userId: string; purpose: string };
    if (decoded.purpose !== 'password_reset') {
      throw new Error('Invalid reset token');
    }
    return { userId: decoded.userId };
  },
};
