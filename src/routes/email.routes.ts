import { Router, Request, Response } from 'express';
import { emailService } from '../services/email.service';

export const emailRouter = Router();

/**
 * POST /api/email/test
 * Send a verification test email via Resend to verify domain setup
 */
emailRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ success: false, message: 'Recipient email "to" is required' });
    }

    const result = await emailService.send({
      to,
      subject: 'Test Email from AI Campus OS (via Resend)',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0B1528;">🎉 Resend Email Integration Verified!</h2>
          <p style="color: #475569;">
            This email confirms that your backend is successfully connected to Resend with domain <strong>aicampusintelligent.com</strong>.
          </p>
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 13px;">
            ✓ Status: Active & Operational
          </div>
        </div>
      `,
      text: 'Test email from AI Campus OS via Resend.',
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      message: `Test email sent to ${to}`,
      data: result.data,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

/**
 * POST /api/email/send
 * Generic email sending endpoint
 */
emailRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, message: 'Missing required fields: to, subject, html' });
    }

    const result = await emailService.send({ to, subject, html, text });
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({ success: true, data: result.data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

/**
 * POST /api/email/contact-sales
 * Send notification when user submits the Contact Sales modal
 */
emailRouter.post('/contact-sales', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, organization, role, message } = req.body;

    // Send confirmation to the prospective client
    await emailService.send({
      to: email,
      subject: `Thank you for contacting AI Campus OS, ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0B1528;">Thank you for reaching out!</h2>
          <p style="color: #475569;">
            Hello ${name}, we have received your inquiry for <strong>${organization || 'your organization'}</strong>.
            A campus placement specialist will get in touch with you within 24 hours.
          </p>
          <div style="margin-top: 20px; font-size: 12px; color: #94a3b8;">
            AI Campus OS · aicampusintelligent.com
          </div>
        </div>
      `,
    });

    return res.json({ success: true, message: 'Inquiry received and confirmation email dispatched.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});
