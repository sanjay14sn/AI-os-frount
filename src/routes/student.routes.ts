import { Router } from 'express';
import {
  getStudents, getStudentById, getStudentStats,
  updateStudent, deleteStudent, getMyProfile, createStudent,
  getStudentDashboardData
} from '../controllers/student.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', createStudent);
router.use(authenticate);

router.get('/stats', getStudentStats);
router.get('/me/dashboard', getStudentDashboardData);
router.get('/me', getMyProfile);
router.get('/', getStudents);
router.get('/:id', getStudentById);
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.delete('/:id', deleteStudent);

export default router;
