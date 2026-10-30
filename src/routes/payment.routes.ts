import { Router } from 'express';
import { createOrder, verifyPayment, getPaymentConfig } from '../controllers/payment.controller';

const router = Router();

// Routes for Payment
router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.get('/config', getPaymentConfig);

export default router;
