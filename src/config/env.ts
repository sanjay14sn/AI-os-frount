import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] || fallback;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const env = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  mongodbUri: getEnv('MONGODB_URI'),

  jwt: {
    secret: getEnv('JWT_SECRET', 'dev_jwt_secret_please_change_me'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_please_change_me'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  serpApiKey: process.env.SERPAPI_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'AI Campus OS <support@aicampusintelligent.com>',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SVM PlacementOS <noreply@placementos.ai>',
  },

  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '5000', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
  },
} as const;
