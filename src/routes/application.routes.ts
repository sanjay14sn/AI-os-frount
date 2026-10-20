import { Router } from 'express';
import { getApplications, getApplicationById, applyToJob, updateApplicationStatus } from '../controllers/application.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getApplications);
router.get('/:id', getApplicationById);
router.post('/', applyToJob);
router.put('/:id/status', updateApplicationStatus);

export default router;
