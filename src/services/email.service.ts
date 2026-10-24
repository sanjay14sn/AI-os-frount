import { Resend } from 'resend';
import { env } from '../config/env';

// Initialize Resend Client
const resend = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export const emailService = {
  /**
   * Generic send email method using Resend API
   */
  send: async (options: SendEmailOptions) => {
    const sender = options.from || env.resend.from || 'AI Campus OS <support@aicampusintelligent.com>';
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    if (!resend) {
      console.warn('[Resend] ⚠️ RESEND_API_KEY is not set. Email logged to console:');
      console.log(`[Resend Mock] To: ${recipients.join(', ')} | Subject: ${options.subject}`);
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    try {
      const response = await resend.emails.send({
        from: sender,
        to: recipients,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (response.error) {
        console.error('[Resend] ❌ Resend API Error:', response.error);
        return { success: false, error: response.error };
      }

      console.log(`[Resend] ✅ Email sent successfully to: ${recipients.join(', ')} (ID: ${response.data?.id})`);
      return { success: true, data: response.data };
    } catch (err: any) {
      console.error('[Resend] ❌ Exception while sending email:', err?.message || err);
      return { success: false, error: err?.message || 'Failed to send email' };
    }
  },

  /**
   * Send 6-digit OTP verification email
   */
  sendOtp: async (email: string, name: string, otp: string, expiresInMinutes: number = 10) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #0B1528; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #94a3b8; margin: 6px 0 0; font-size: 13px; font-weight: 500; }
    .body { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0B1528; margin-bottom: 12px; }
    .desc { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px; }
    .otp-card { background: #f0f7ff; border: 2px dashed #0066FF; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0; }
    .otp-value { font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #0066FF; font-family: monospace; }
    .otp-hint { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
    .warning { background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #92400e; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Campus OS</h1>
      <p>Autonomous Campus Placement Operating System</p>
    </div>
    <div class="body">
      <div class="greeting">Hello ${name || 'Candidate'},</div>
      <p class="desc">
        Use the single-use verification code below to verify your account. This code is confidential and will expire in <strong>${expiresInMinutes} minutes</strong>.
      </p>
      <div class="otp-card">
        <div class="otp-value">${otp}</div>
        <div class="otp-hint">Enter this 6-digit verification code to proceed</div>
      </div>
      <div class="warning">
        🔒 <strong>Security Notice:</strong> Never share this code with anyone. Our placement officers will never ask for your OTP.
      </div>
    </div>
    <div class="footer">
      © 2026 AI Campus OS · aicampusintelligent.com · All rights reserved
    </div>
  </div>
</body>
</html>
    `;

    return emailService.send({
      to: email,
      subject: `${otp} — Your AI Campus OS Verification Code`,
      html,
      text: `Your AI Campus OS verification code is: ${otp}. Valid for ${expiresInMinutes} minutes.`,
    });
  },

  /**
   * Send Password Reset Link Email
   */
  sendPasswordReset: async (email: string, name: string, resetUrl: string) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #0B1528; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px 28px; }
    .btn { display: inline-block; background: #0066FF; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 700; font-size: 14px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Campus OS</h1>
    </div>
    <div class="body">
      <p>Hello <strong>${name || 'User'}</strong>,</p>
      <p style="color:#475569; font-size:14px; line-height:1.6;">
        We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
      </p>
      <div style="text-align: center;">
        <a class="btn" href="${resetUrl}">Reset My Password</a>
      </div>
      <p style="color:#94a3b8; font-size:12px; margin-top:24px;">
        If you did not request this, you can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
    <div class="footer">
      © 2026 AI Campus OS · aicampusintelligent.com
    </div>
  </div>
</body>
</html>
    `;

    return emailService.send({
      to: email,
      subject: `Reset your AI Campus OS password`,
      html,
      text: `Reset your password by following this link: ${resetUrl}`,
    });
  },

  /**
   * Send Welcome Email on successful onboarding
   */
  sendWelcome: async (email: string, name: string, role: string) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .header { background: #0B1528; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; }
    .body { padding: 32px 28px; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
    .btn { display: inline-block; background: #0B1528; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; background: #f8fafc; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Campus OS</h1>
    </div>
    <div class="body">
      <span class="badge">${role.toUpperCase()} ACCOUNT</span>
      <h2 style="font-size:20px; color:#0B1528; margin: 0 0 12px;">Welcome aboard, ${name}!</h2>
      <p style="color:#475569; font-size:14px; line-height:1.6;">
        Your account on AI Campus OS is active. You can now access autonomous drive management, verified credential rosters, and AI-powered assessments.
      </p>
      <div style="text-align: center;">
        <a class="btn" href="https://aicampusintelligent.com/login">Go to Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      © 2026 AI Campus OS · aicampusintelligent.com
    </div>
  </div>
</body>
</html>
    `;

    return emailService.send({
      to: email,
      subject: `Welcome to AI Campus OS, ${name}!`,
      html,
    });
  }
};
