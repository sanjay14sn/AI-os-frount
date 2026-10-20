import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { env } from '../config/env';
import {
  login, registerStudent, registerCollege, verifyOtp, resendOtp,
  forgotPassword, resetPassword, getMe, changePassword,
  loginSchema, registerStudentSchema, registerCollegeSchema,
  verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema,
} from '../controllers/auth.controller';
import { z } from 'zod';

const router = Router();

// Strict rate limit for auth endpoints
const authRateLimit = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Public Routes ────────────────────────────────────────────────────────────

router.post('/login', authRateLimit, validate(loginSchema), login);
router.post('/register/student', validate(registerStudentSchema), registerStudent);
router.post('/register/college', validate(registerCollegeSchema), registerCollege);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post(
  '/resend-otp',
  authRateLimit,
  validate(z.object({ email: z.string().email().toLowerCase() })),
  resendOtp
);
router.post('/forgot-password', authRateLimit, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// ─── Protected Routes ─────────────────────────────────────────────────────────

router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/logout', authenticate, (_req, res) => {
  // JWT is stateless — client should discard token
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
