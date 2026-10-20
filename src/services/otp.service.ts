import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

// ─── OTP Generator ───────────────────────────────────────────────────────────

export const generateOtp = (): string => {
  // Cryptographically secure 6-digit OTP
  return String(crypto.randomInt(100000, 999999));
};

export const getOtpExpiry = (): Date => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + env.otp.expiresMinutes);
  return expiry;
};

// ─── Email Transporter ────────────────────────────────────────────────────────

const createTransporter = () => {
  if (!env.smtp.user || !env.smtp.pass) {
    console.warn('[OTP] ⚠️  SMTP credentials not configured. OTPs will be logged to console only.');
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const otpEmailTemplate = (name: string, otp: string, expiresIn: number): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #08546c, #0891b2); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px; }
    .body { padding: 32px; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 16px; }
    .otp-box { background: #f0f9ff; border: 2px solid #bae6fd; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp { font-size: 40px; font-weight: 900; letter-spacing: 12px; color: #08546c; font-family: monospace; }
    .otp-hint { font-size: 13px; color: #64748b; margin-top: 8px; }
    .warning { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #713f12; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SVM PlacementOS</h1>
      <p>AI-Powered Placement Platform</p>
    </div>
    <div class="body">
      <p class="greeting">Hello <strong>${name}</strong>,</p>
      <p style="color:#475569;font-size:14px;">Use the verification code below to complete your registration. This code is valid for <strong>${expiresIn} minutes</strong>.</p>
      <div class="otp-box">
        <div class="otp">${otp}</div>
        <div class="otp-hint">Enter this 6-digit code in the app</div>
      </div>
      <div class="warning">
        ⚠️ Never share this code with anyone. Our team will never ask for your OTP.
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div class="footer">© 2025 SVM PlacementOS · All rights reserved</div>
  </div>
</body>
</html>
`;

const passwordResetEmailTemplate = (name: string, resetUrl: string): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f8fafc; }
    .container { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #08546c, #0891b2); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 800; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #08546c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 24px 0; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>SVM PlacementOS</h1></div>
    <div class="body">
      <p>Hello <strong>${name}</strong>,</p>
      <p style="color:#475569;">We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;">
        <a class="btn" href="${resetUrl}">Reset Password</a>
      </div>
      <p style="color:#94a3b8;font-size:12px;">If you didn't request this, ignore this email. Your password won't change.</p>
      <p style="color:#94a3b8;font-size:11px;word-break:break-all;">Or copy this link: ${resetUrl}</p>
    </div>
    <div class="footer">© 2025 SVM PlacementOS</div>
  </div>
</body>
</html>
`;

// ─── OTP Service ─────────────────────────────────────────────────────────────

export const otpService = {
  /**
   * Send OTP via email. Falls back to console log in dev if SMTP not configured.
   */
  sendOtp: async (email: string, name: string, otp: string): Promise<void> => {
    console.log(`[OTP] 📧 OTP for ${email}: ${otp} (expires in ${env.otp.expiresMinutes} min)`);

    const transporter = createTransporter();
    if (!transporter) return; // Dev mode — OTP logged to console

    try {
      await transporter.sendMail({
        from: env.smtp.from,
        to: email,
        subject: `${otp} — Your SVM PlacementOS Verification Code`,
        html: otpEmailTemplate(name, otp, env.otp.expiresMinutes),
      });
      console.log(`[OTP] ✅ Email sent to ${email}`);
    } catch (error) {
      console.error('[OTP] ❌ Failed to send email:', (error as Error).message);
      // Don't throw — OTP is still logged to console for dev testing
    }
  },

  /**
   * Send password reset email
   */
  sendPasswordReset: async (email: string, name: string, resetUrl: string): Promise<void> => {
    console.log(`[RESET] 🔗 Password reset link for ${email}: ${resetUrl}`);

    const transporter = createTransporter();
    if (!transporter) return;

    try {
      await transporter.sendMail({
        from: env.smtp.from,
        to: email,
        subject: 'Reset your SVM PlacementOS password',
        html: passwordResetEmailTemplate(name, resetUrl),
      });
      console.log(`[RESET] ✅ Reset email sent to ${email}`);
    } catch (error) {
      console.error('[RESET] ❌ Failed to send reset email:', (error as Error).message);
    }
  },

  /**
   * Verify OTP — returns true if valid and not expired
   */
  verify: (
    inputOtp: string,
    storedOtp: string,
    expiresAt: Date
  ): { valid: boolean; reason?: string } => {
    if (new Date() > expiresAt) {
      return { valid: false, reason: 'OTP has expired' };
    }
    if (inputOtp !== storedOtp) {
      return { valid: false, reason: 'Invalid OTP' };
    }
    return { valid: true };
  },
};
