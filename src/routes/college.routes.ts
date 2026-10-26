import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getColleges, getCollegeById, updateCollege, toggleCollegeStatus, createCollege, lookupCollege, resetCollegePassword } from '../controllers/college.controller';

const router = Router();

router.get('/lookup', lookupCollege);
router.get('/', getColleges);
router.post('/', createCollege);
router.get('/:id', getCollegeById);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'COLLEGE_ADMIN', 'TPO'), updateCollege);
router.patch('/:id/toggle-status', toggleCollegeStatus);
router.post('/:id/reset-password', resetCollegePassword);

export default router;
