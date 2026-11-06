import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { Payment } from '../models/Payment';

// Initialize Razorpay client with credentials from environment
const getRazorpayInstance = () => {
  const keyId = env.razorpay.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = env.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order or POST /api/payment/create-order
 * Request: { amount (paise), currency, receipt, notes, description, studentEmail, studentId }
 * Return: { order_id, amount, currency, ... }
 * Minimum amount: 100 paise
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const keyId = env.razorpay.keyId || process.env.RAZORPAY_KEY_ID;
    const keySecret = env.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay credentials not configured on server',
        message: 'Authentication failed: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required.',
      });
    }

    const { amount, currency = 'INR', receipt, notes = {}, description, studentEmail, studentId, collegeId } = req.body;

    // Validate amount presence
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Amount in paise is required and must be a valid number.',
      });
    }

    const numericAmount = Math.round(Number(amount));

    // Validate amount >= 100 paise (Minimum required by Razorpay)
    if (numericAmount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Amount too low',
        message: 'Amount must be at least 100 paise (₹1.00).',
      });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay initialization failed',
        message: 'Invalid Razorpay authentication credentials.',
      });
    }

    // Resolve or create customer for AutoPay / recurring mandate if details provided
    let customerId: string | undefined = undefined;
    const isAutoPay = req.body.isAutoPay === true || notes?.autopay === 'true';
    if (isAutoPay || studentEmail) {
      try {
        const customer = await razorpay.customers.create({
          name: req.body.name || req.body.customerName || studentEmail?.split('@')[0] || 'Student Candidate',
          email: studentEmail || 'student@institution.edu.in',
          contact: req.body.contact || req.body.phone || '9999999999',
          fail_existing: 0,
        });
        customerId = customer?.id;
      } catch (custErr) {
        // Customer resolution non-blocking
      }
    }

    const orderOptions: any = {
      amount: numericAmount,
      currency: (currency || 'INR').toUpperCase(),
      receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      notes: {
        ...(typeof notes === 'object' && notes !== null ? notes : {}),
        ...(isAutoPay ? { autopay: 'true', mandate_amount: '30', frequency: 'monthly' } : {}),
      },
    };

    if (customerId) {
      orderOptions.customer_id = customerId;
    }

    let order;
    try {
      order = await razorpay.orders.create(orderOptions);
    } catch (rzpErr: any) {
      console.error('Razorpay Order API Error:', rzpErr);
      const statusCode = rzpErr.statusCode === 401 ? 401 : 500;
      return res.status(statusCode).json({
        success: false,
        error: rzpErr.error?.description || rzpErr.message || 'Razorpay order creation failed',
        message: rzpErr.message || 'An error occurred while creating order with Razorpay.',
      });
    }

    // Persist to database if available
    // Persist to database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Payment.create({
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          status: 'created',
          receipt: orderOptions.receipt,
          notes: orderOptions.notes,
          description: description || 'AI PlacementOS Payment',
          studentEmail: studentEmail || notes.studentEmail,
          studentId: studentId || notes.studentId,
          collegeId: collegeId || notes.collegeId,
        });
      } catch (dbErr) {
        console.warn('Could not persist payment record to DB:', dbErr);
      }
    }

    // Return the required contract: { order_id, amount, currency }
    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      customer_id: customerId,
      receipt: order.receipt,
      created_at: order.created_at,
    });
  } catch (err: any) {
    console.error('Unexpected error in createOrder:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message || 'Failed to create order',
    });
  }
};



let studentPlanId: string | undefined;
let studentPlanPromise: Promise<string> | undefined;

const getStudentPlanId = async (razorpay: Razorpay): Promise<string> => {
  const configuredPlanId = process.env.RAZORPAY_STUDENT_PLAN_ID;
  if (configuredPlanId) return configuredPlanId;
  if (studentPlanId) return studentPlanId;
  if (!studentPlanPromise) {
    studentPlanPromise = razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: 'AI Campus OS Student Placement Pass',
        amount: 3000,
        currency: 'INR',
        description: 'Monthly student placement access after 14-day trial',
      },
      notes: { product: 'student-placement-autopay' },
    }).then((plan) => {
      studentPlanId = plan.id;
      return plan.id;
    }).catch((error) => {
      studentPlanPromise = undefined;
      throw error;
    });
  }
  return studentPlanPromise;
};

/** Create a ₹30/month subscription with a 14-day trial (no upfront add-on). */
export const createStudentSubscription = async (req: Request, res: Response) => {
  try {
    const keyId = env.razorpay.keyId || process.env.RAZORPAY_KEY_ID;
    const razorpay = getRazorpayInstance();
    if (!keyId || !razorpay) {
      return res.status(401).json({ success: false, message: 'Razorpay credentials are not configured.' });
    }
    const planId = await getStudentPlanId(razorpay);
    const startAt = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 0,
      start_at: startAt,
      notes: {
        studentId: String(req.body.studentId || ''),
        college: String(req.body.college || ''),
        studentEmail: String(req.body.email || ''),
        trialDays: '14',
        firstCharge: 'INR 30',
      },
    });
    return res.status(200).json({
      success: true,
      subscription_id: subscription.id,
      key_id: keyId,
      start_at: startAt,
    });
  } catch (err: any) {
    console.error('Razorpay student subscription creation failed:', err);
    return res.status(500).json({ success: false, error: err.error?.description || err.message, message: 'Failed to create student AutoPay subscription.' });
  }
};

/** Verify Razorpay's subscription authorization callback signature. */
export const verifySubscription = async (req: Request, res: Response) => {
  try {
    const keySecret = env.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET;
    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!keySecret) return res.status(401).json({ success: false, message: 'Razorpay secret is not configured.' });
    if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Subscription ID, payment ID, and signature are required.' });
    }
    const expected = crypto.createHmac('sha256', keySecret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(String(razorpay_signature), 'utf8');
    const verified = expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    if (!verified) return res.status(400).json({ success: false, verified: false, message: 'Subscription signature verification failed.' });
    return res.status(200).json({ success: true, verified: true, message: 'Subscription authorization verified.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, message: 'Could not verify subscription authorization.' });
  }
};

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment or POST /api/payment/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const keySecret = env.razorpay.keySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay secret not configured',
        message: 'Server cannot verify payment without RAZORPAY_KEY_SECRET.',
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
      payment_id,
      signature,
    } = req.body;

    // Support both standard Razorpay naming and shorter aliases
    const finalOrderId = razorpay_order_id || order_id;
    const finalPaymentId = razorpay_payment_id || payment_id;
    const finalSignature = razorpay_signature || signature;

    // Missing fields check: return 400
    if (!finalOrderId || !finalPaymentId || !finalSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing fields',
        message: 'Missing required payment verification fields: order_id, payment_id, and signature are all required.',
      });
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${finalOrderId}|${finalPaymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    // Safe comparison: compare generated signature with razorpay_signature
    const genBuf = Buffer.from(generatedSignature, 'utf-8');
    const sigBuf = Buffer.from(finalSignature, 'utf-8');
    const signaturesMatch = genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf);

    if (!signaturesMatch) {
      // Signature mismatch: return 400, do NOT mark as paid
      if (mongoose.connection.readyState === 1) {
        try {
          await Payment.findOneAndUpdate(
            { orderId: finalOrderId },
            {
              status: 'failed',
              paymentId: finalPaymentId,
              signature: finalSignature,
            }
          );
        } catch (dbErr) {
          console.warn('DB update failed on signature mismatch:', dbErr);
        }
      }

      return res.status(400).json({
        success: false,
        verified: false,
        error: 'Signature Mismatch',
        message: 'Payment verification failed: razorpay_signature does not match generated HMAC signature.',
      });
    }

    // Success: signatures match
    if (mongoose.connection.readyState === 1) {
      try {
        await Payment.findOneAndUpdate(
          { orderId: finalOrderId },
          {
            status: 'paid',
            paymentId: finalPaymentId,
            signature: finalSignature,
            paidAt: new Date(),
          },
          { new: true }
        );
      } catch (dbErr) {
        console.warn('DB update failed on payment success:', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Payment verified successfully',
      razorpay_order_id: finalOrderId,
      razorpay_payment_id: finalPaymentId,
      order_id: finalOrderId,
      payment_id: finalPaymentId,
    });
  } catch (err: any) {
    console.error('Unexpected error in verifyPayment:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message || 'Failed to verify payment',
    });
  }
};

/**
 * Public Config Endpoint: GET /api/payment/config
 * Returns public Razorpay key ID for frontend checkout initialization
 */
export const getPaymentConfig = (_req: Request, res: Response) => {
  const keyId = env.razorpay.keyId || process.env.RAZORPAY_KEY_ID || '';
  return res.status(200).json({
    success: true,
    key_id: keyId,
  });
};
