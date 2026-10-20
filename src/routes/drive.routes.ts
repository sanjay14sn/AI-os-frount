import { Router } from 'express';
import { getDrives, getDriveById, createDrive, updateDrive, deleteDrive } from '../controllers/drive.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, getDrives);
router.get('/:id', getDriveById);
router.post('/', createDrive);
router.put('/:id', authenticate, authorize('TPO', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), updateDrive);
router.delete('/:id', authenticate, authorize('TPO', 'COLLEGE_ADMIN', 'SUPER_ADMIN'), deleteDrive);

export default router;
