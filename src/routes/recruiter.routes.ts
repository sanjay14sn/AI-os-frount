import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getRecruiterDashboardData } from '../controllers/recruiter.controller';

const router = Router();

// Require authentication for all recruiter routes
router.use(authenticate);

router.get('/me/dashboard', getRecruiterDashboardData);

export default router;
