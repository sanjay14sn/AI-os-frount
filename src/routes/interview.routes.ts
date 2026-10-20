import { Router } from 'express';
import { getInterviews, scheduleInterview, updateInterviewStatus, submitFeedback, checkConflicts } from '../controllers/interview.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/check-conflicts', checkConflicts);
router.get('/', getInterviews);
router.post('/', scheduleInterview);
router.put('/:id/status', updateInterviewStatus);
router.post('/:id/feedback', submitFeedback);

export default router;
