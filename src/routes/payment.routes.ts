import { Router } from 'express';
import { createOrder, verifyPayment, getPaymentConfig, createStudentSubscription, verifySubscription } from '../controllers/payment.controller';

const router = Router();

// Routes for Payment
router.post('/create-order', createOrder);
router.post('/create-student-subscription', createStudentSubscription);
router.post('/verify-subscription', verifySubscription);
router.post('/verify-payment', verifyPayment);
router.get('/config', getPaymentConfig);

export default router;
