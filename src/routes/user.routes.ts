import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getUsers, toggleUserStatus, deleteUser } from '../controllers/user.controller';

const router = Router();

// Only SUPER_ADMIN can manage users
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

router.get('/', getUsers);
router.patch('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

export default router;
